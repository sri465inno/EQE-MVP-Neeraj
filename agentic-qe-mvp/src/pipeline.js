'use strict';
// Cycle orchestration. Flow 1 (baseline) and Flow 2 (incremental) with human gates.
const path = require('path');
const { loadInputs } = require('./inputs');
const { normalise, applyReview } = require('./normalise');
const { classifyDelta } = require('./delta');
const design = require('./agents/design');
const { executeSuite } = require('./execution');
const { raiseDefects } = require('./defects');
const { computeCoverage } = require('./coverage');
const { buildCycleReport } = require('./report');

const clone = (x) => JSON.parse(JSON.stringify(x));
const now = () => new Date().toISOString();

const PHASES = {
  baseline: ['ingest', 'normalise', 'review', 'requirements', 'rules', 'testcases', 'scripts', 'execution', 'defects', 'report'],
  incremental: ['ingest', 'normalise', 'review', 'delta', 'requirements', 'rules', 'testcases', 'scripts', 'merge-approval', 'execution', 'defects', 'report'],
};
const PHASE_LABEL = {
  ingest: 'Ingest inputs', normalise: 'Normalise (3-way compare)', review: 'Human review of requirement set', delta: 'Delta classification',
  requirements: 'Requirements repository agent', rules: 'Business rules agent', testcases: 'Test case agent', scripts: 'Automation script agent',
  'merge-approval': 'Human approval to merge', execution: 'Execution agent (Playwright, real run)', defects: 'Defect agent', report: 'Cycle report agent',
};

function setPhase(cycle, name, status, summary) {
  const p = cycle.phases.find((x) => x.name === name);
  if (!p) return;
  if (status === 'running') p.startedAt = now();
  if (['done', 'failed', 'skipped'].includes(status)) p.finishedAt = now();
  p.status = status;
  if (summary !== undefined) p.summary = summary;
}

class Pipeline {
  constructor(store, { env = process.env } = {}) {
    this.store = store;
    this.env = env;
    this.running = new Map();
  }

  /** Marks cycles that were mid-run when the process stopped; they can be resumed. */
  recover() {
    for (const c of this.store.listCycles()) {
      if (c.status === 'running') {
        c.status = 'interrupted';
        c.note = 'The server restarted while this cycle was running. Use Resume to re-run the remaining phases.';
        this.store.saveCycle(c);
      }
    }
  }

  async startCycle({ type = 'baseline', name, baselineId, inputs = {}, sutBuild, reviewer }) {
    if (!['baseline', 'incremental'].includes(type)) throw httpError(400, 'type must be "baseline" or "incremental"');
    let baseline = null;
    if (type === 'incremental') {
      baseline = this.store.getBaseline(baselineId);
      if (!baseline) throw httpError(400, 'Pick an existing approved baseline for an incremental cycle');
    }
    const slots = type === 'baseline' ? ['initiative', 'epic', 'codebase'] : ['epic', 'codebase'];
    const loaded = await loadInputs(inputs, slots, { env: this.env });
    if (!loaded.length) throw httpError(400, 'Provide at least one input');
    const id = this.store.nextId('nextCycle', 'CYC');
    const n = Number(id.slice(4));
    const codebase = loaded.find((i) => i.slot === 'codebase');
    const statements = loaded.flatMap((i) => i.statements);
    const normalisation = normalise(statements);
    const cycle = {
      id,
      name: name || `Cycle ${n} - ${type === 'baseline' ? 'Baseline' : 'Incremental'}`,
      type,
      status: 'awaiting-review',
      createdAt: now(),
      createdBy: reviewer || null,
      baselineId: baseline ? baseline.id : null,
      baselineVersionAtStart: baseline ? baseline.version : null,
      sutBuild: sutBuild || codebase?.branch || 'main',
      inputs: loaded.map(({ statements: s, ...rest }) => ({ ...rest, statementCount: s.length })),
      normalisation,
      phases: PHASES[type].map((p) => ({ name: p, label: PHASE_LABEL[p], status: 'pending' })),
      approvals: [],
      artifacts: {},
    };
    setPhase(cycle, 'ingest', 'done', `${loaded.length} input(s), ${statements.length} statements`);
    setPhase(cycle, 'normalise', 'done', `${normalisation.counts.agreed} agreed · ${normalisation.counts['jira-only']} Jira only · ${normalisation.counts['code-only']} code only · ${normalisation.counts.conflict} conflicts`);
    setPhase(cycle, 'review', 'waiting');
    if (baseline) cycle.deltaPreview = this.previewDelta(cycle, {}, baseline);
    return this.store.saveCycle(cycle);
  }

  /** Delta split before anything is designed (conflicts not yet resolved are listed separately). */
  previewDelta(cycle, decisions = {}, baseline = this.store.getBaseline(cycle.baselineId)) {
    const excluded = decisions.excluded || [];
    const resolutions = decisions.resolutions || {};
    const pending = cycle.normalisation.groups.filter((g) => g.bucket === 'conflict' && !excluded.includes(g.id) && !resolutions[g.id]).map((g) => g.id);
    const reviewed = applyReview(cycle.normalisation, { excluded: [...excluded, ...pending], resolutions });
    return { ...classifyDelta(baseline.requirements, reviewed), pendingConflicts: pending };
  }

  review(cycleId, { reviewer, excluded = [], resolutions = {}, comment = '' }) {
    const cycle = this.mustGet(cycleId);
    if (cycle.status !== 'awaiting-review') throw httpError(409, `Cycle is ${cycle.status}, not awaiting review`);
    if (!reviewer || !String(reviewer).trim()) throw httpError(400, 'Reviewer name is required');
    let reviewed;
    try {
      reviewed = applyReview(cycle.normalisation, { excluded, resolutions });
    } catch (e) {
      throw httpError(400, e.message);
    }
    cycle.review = { reviewer, at: now(), excluded, resolutions, comment };
    cycle.reviewed = reviewed;
    cycle.approvals.push({ gate: 'Requirement set review', by: reviewer, at: cycle.review.at, decision: 'approved', comment,
      detail: `${reviewed.length} requirements approved; ${excluded.length} excluded; ${Object.keys(resolutions).length} conflict(s) resolved` });
    setPhase(cycle, 'review', 'done', `Approved by ${reviewer}`);
    cycle.status = 'running';
    this.store.saveCycle(cycle);
    return this.track(cycle.id, cycle.type === 'baseline' ? this.runBaseline(cycle.id) : this.runIncrementalDesign(cycle.id));
  }

  track(id, promise) {
    const p = promise.catch((e) => {
      const c = this.store.getCycle(id);
      c.status = 'failed';
      c.error = e.message;
      const running = c.phases.find((x) => x.status === 'running');
      if (running) setPhase(c, running.name, 'failed', e.message);
      this.store.saveCycle(c);
    }).finally(() => this.running.delete(id));
    this.running.set(id, p);
    return { cycle: this.store.getCycle(id), done: p };
  }

  runDesignPhases(cycle, requirements, previous) {
    const counters = cycle.counters;
    setPhase(cycle, 'requirements', 'done', `${requirements.length} requirements`);
    const out = design.designAgents(requirements, { cycle, counters, previous });
    const count = (arr, st) => arr.filter((x) => x.status === st).length;
    const split = (arr) => (previous ? ` (${count(arr, 'new')} new · ${count(arr, 're-designed')} re-designed · ${count(arr, 'carried over')} carried over)` : '');
    setPhase(cycle, 'rules', 'done', `${out.rules.length} business rules${split(out.rules)}`);
    setPhase(cycle, 'testcases', 'done', `${out.testCases.length} test cases${split(out.testCases)}`);
    setPhase(cycle, 'scripts', 'done', `${out.scripts.length} Playwright specs${split(out.scripts)}`);
    cycle.artifacts = { ...cycle.artifacts, requirements, rules: out.rules, testCases: out.testCases, scripts: out.scripts, affected: out.affected };
  }

  async runBaseline(cycleId) {
    const cycle = this.mustGet(cycleId);
    cycle.counters = { req: 0, rule: 0, case: 0 };
    setPhase(cycle, 'requirements', 'running');
    const requirements = design.requirementsAgentBaseline(cycle.reviewed, { cycle, counters: cycle.counters });
    this.runDesignPhases(cycle, requirements, null);
    this.store.saveCycle(cycle);
    await this.runExecutionPhases(cycle.id, { previousDefects: [] });
    const done = this.mustGet(cycleId);
    const bid = this.store.nextId('nextBaseline', 'BL');
    const baseline = {
      id: bid, name: `${done.inputs.find((i) => i.slot === 'epic')?.ref || 'Baseline'} baseline`, version: 1,
      createdAt: now(), sourceCycleId: done.id, cycles: [done.id], lastCycleId: done.id,
      requirements: done.artifacts.requirements, rules: done.artifacts.rules, testCases: done.artifacts.testCases, scripts: done.artifacts.scripts,
      counters: done.counters,
      history: [{ version: 1, at: now(), cycleId: done.id, change: 'Baseline established', approvedBy: done.review.reviewer }],
    };
    this.store.saveBaseline(baseline);
    done.baselineId = bid;
    done.baselineVersionAfter = 1;
    done.status = 'completed';
    done.completedAt = now();
    done.report = await buildCycleReport(done, { store: this.store, env: this.env });
    this.store.saveCycle(done);
  }

  async runIncrementalDesign(cycleId) {
    const cycle = this.mustGet(cycleId);
    const baseline = this.store.getBaseline(cycle.baselineId);
    setPhase(cycle, 'delta', 'running');
    const delta = classifyDelta(baseline.requirements, cycle.reviewed);
    cycle.delta = delta;
    setPhase(cycle, 'delta', 'done', delta.summary);
    cycle.counters = clone(baseline.counters);
    const requirements = design.requirementsAgentIncremental(baseline.requirements, delta, { cycle, counters: cycle.counters });
    this.runDesignPhases(cycle, requirements, baseline);
    const a = cycle.artifacts;
    cycle.mergeProposal = {
      baselineId: baseline.id,
      baselineVersion: baseline.version,
      requirements: a.requirements.filter((r) => ['new', 'enhanced'].includes(r.status)).map((r) => r.id),
      rules: a.rules.filter((r) => r.status !== 'carried over').map((r) => r.id),
      testCases: a.testCases.filter((t) => t.status !== 'carried over').map((t) => t.key),
      scripts: a.scripts.filter((s) => s.status !== 'carried over').map((s) => s.file),
    };
    setPhase(cycle, 'merge-approval', 'waiting');
    cycle.status = 'awaiting-merge';
    this.store.saveCycle(cycle);
  }

  decideMerge(cycleId, { decision, approver, comment = '' }) {
    const cycle = this.mustGet(cycleId);
    if (cycle.status !== 'awaiting-merge') throw httpError(409, `Cycle is ${cycle.status}, not awaiting merge approval`);
    if (!approver || !String(approver).trim()) throw httpError(400, 'Approver name is required');
    if (!['approve', 'reject'].includes(decision)) throw httpError(400, 'decision must be "approve" or "reject"');
    const baseline = this.store.getBaseline(cycle.baselineId);
    const at = now();
    if (decision === 'reject') {
      cycle.approvals.push({ gate: 'Merge into baseline', by: approver, at, decision: 'rejected', comment, detail: `Baseline ${baseline.id} v${baseline.version} left untouched` });
      setPhase(cycle, 'merge-approval', 'done', `Rejected by ${approver}`);
      for (const p of ['execution', 'defects', 'report']) setPhase(cycle, p, 'skipped', 'Merge rejected');
      cycle.status = 'rejected';
      this.store.saveCycle(cycle);
      return { cycle, done: Promise.resolve() };
    }
    if (baseline.version !== cycle.mergeProposal.baselineVersion) throw httpError(409, 'Baseline changed since this delta was designed; start a new incremental cycle');
    const a = cycle.artifacts;
    const previousVersion = baseline.version;
    const merged = {
      ...baseline,
      version: baseline.version + 1,
      requirements: a.requirements, rules: a.rules, testCases: a.testCases, scripts: a.scripts,
      counters: cycle.counters,
      cycles: [...baseline.cycles, cycle.id],
      history: [...baseline.history, { version: baseline.version + 1, at, cycleId: cycle.id, change: cycle.delta.summary, approvedBy: approver }],
    };
    const previousDefects = this.store.getCycle(baseline.lastCycleId)?.artifacts?.defects || [];
    merged.lastCycleId = cycle.id;
    this.store.saveBaseline(merged);
    cycle.approvals.push({ gate: 'Merge into baseline', by: approver, at, decision: 'approved', comment,
      detail: `${cycle.mergeProposal.requirements.length} requirements, ${cycle.mergeProposal.testCases.length} test cases, ${cycle.mergeProposal.scripts.length} scripts merged: ${baseline.id} v${previousVersion} -> v${merged.version}` });
    cycle.baselineVersionAfter = merged.version;
    setPhase(cycle, 'merge-approval', 'done', `Approved by ${approver}; ${baseline.id} is now v${merged.version}`);
    cycle.status = 'running';
    this.store.saveCycle(cycle);
    return this.track(cycle.id, (async () => {
      await this.runExecutionPhases(cycle.id, { previousDefects });
      const c = this.mustGet(cycle.id);
      c.status = 'completed';
      c.completedAt = now();
      c.report = await buildCycleReport(c, { store: this.store, env: this.env });
      this.store.saveCycle(c);
    })());
  }

  async runExecutionPhases(cycleId, { previousDefects }) {
    let cycle = this.mustGet(cycleId);
    setPhase(cycle, 'execution', 'running');
    this.store.saveCycle(cycle);
    const execution = await executeSuite({
      scripts: cycle.artifacts.scripts, testCases: cycle.artifacts.testCases,
      runDir: this.store.runDir(cycle.id), sutBuild: cycle.sutBuild,
    });
    cycle = this.mustGet(cycleId);
    cycle.artifacts.execution = execution;
    const s = execution.summary;
    setPhase(cycle, 'execution', 'done', `${s.executed} executed · ${s.passed} passed · ${s.failed} failed · ${s.notRun} not run (manual)`);
    setPhase(cycle, 'defects', 'running');
    const { defects, resolved, nextNo } = raiseDefects({
      execution, testCases: cycle.artifacts.testCases, requirements: cycle.artifacts.requirements, cycle,
      previousDefects, startNo: this.store.meta().nextDefect,
    });
    this.store.bumpDefectCounter(nextNo);
    cycle.artifacts.defects = defects;
    cycle.artifacts.resolvedDefects = resolved;
    setPhase(cycle, 'defects', 'done', `${defects.length} defect(s) from real failures${resolved.length ? ` · ${resolved.length} resolved` : ''}`);
    cycle.artifacts.coverage = computeCoverage(cycle.artifacts.requirements, cycle.artifacts.testCases, execution.results);
    setPhase(cycle, 'report', 'done', 'Report generated');
    this.store.saveCycle(cycle);
  }

  resume(cycleId) {
    const cycle = this.mustGet(cycleId);
    if (cycle.status !== 'interrupted' && cycle.status !== 'failed') throw httpError(409, 'Only interrupted or failed cycles can be resumed');
    cycle.status = 'running';
    cycle.error = null;
    for (const p of cycle.phases) if (['running', 'failed'].includes(p.status)) p.status = 'pending';
    this.store.saveCycle(cycle);
    if (cycle.type === 'baseline') return this.track(cycle.id, this.runBaseline(cycle.id));
    const merged = cycle.approvals.some((a) => a.gate === 'Merge into baseline' && a.decision === 'approved');
    if (!merged) return this.track(cycle.id, this.runIncrementalDesign(cycle.id));
    return this.track(cycle.id, (async () => {
      const baseline = this.store.getBaseline(cycle.baselineId);
      const prevCycleId = baseline.cycles[baseline.cycles.length - 2];
      await this.runExecutionPhases(cycle.id, { previousDefects: this.store.getCycle(prevCycleId)?.artifacts?.defects || [] });
      const c = this.mustGet(cycle.id);
      c.status = 'completed';
      c.completedAt = now();
      c.report = await buildCycleReport(c, { store: this.store, env: this.env });
      this.store.saveCycle(c);
    })());
  }

  mustGet(id) {
    const c = this.store.getCycle(id);
    if (!c) throw httpError(404, `Cycle ${id} not found`);
    return c;
  }

  runDir(id) { return path.join(this.store.runDir(id)); }
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

module.exports = { Pipeline, PHASES, PHASE_LABEL, httpError };
