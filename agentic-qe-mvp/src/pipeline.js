'use strict';
// Cycle orchestration. Flow 1 (baseline) and Flow 2 (incremental) with human gates.
const path = require('path');
const { loadInputs } = require('./inputs');
const { normalise, applyReview } = require('./normalise');
const { classifyDelta } = require('./delta');
const design = require('./agents/design');
const { executeSuite, summarise } = require('./execution');
const { raiseDefects } = require('./defects');
const { computeCoverage } = require('./coverage');
const { DEFAULT_BUILD } = require('../sut/server');
const fs = require('fs');
const { buildCycleReport, collectHandovers } = require('./report');
const { compareCycles } = require('./compare');
const { testCasesExport } = require('./excel');
const { agentContext, checkHandover, selectSkills } = require('./skills');
const { producedBy } = require('./handover');
const { reviewInputs } = require('./agents/review');
const { getTestingType } = require('./testing-types');

const clone = (x) => JSON.parse(JSON.stringify(x));
const now = () => new Date().toISOString();

const PHASES = {
  baseline: ['ingest', 'normalise', 'review-agent', 'review', 'requirements', 'rules', 'testcases', 'scripts', 'execution', 'defects', 'report'],
  incremental: ['ingest', 'normalise', 'review-agent', 'review', 'delta', 'requirements', 'rules', 'testcases', 'scripts', 'merge-approval', 'execution', 'defects', 'report'],
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

/** Execution record when the type of testing leaves nothing automated to run: nothing is faked. */
function noAutomatedRun(runCases, cycle) {
  const results = runCases.map((t) => ({ key: t.key, requirementId: t.requirementId, ruleId: t.ruleId || null, name: t.name, type: t.type, scriptFile: null,
    status: 'not-run', reason: 'Manual test case - not automated, not executed', duration: 0, error: null, evidence: [] }));
  const at = now();
  return { executed: false, tool: 'Playwright not started: no automated case in this run', sut: { build: cycle.sutBuild }, startedAt: at, finishedAt: at,
    specFiles: [], results, summary: summarise(results) };
}

class Pipeline {
  constructor(store, { env = process.env, skills = [], fetchImpl = globalThis.fetch } = {}) {
    this.store = store;
    this.env = env;
    this.skills = skills;
    this.fetchImpl = fetchImpl;
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

  /** Hands an agent the bodies of the skills that target it, and records which ones it saw. */
  skillContext(cycle, agentId) {
    const ctx = agentContext(cycle.skills, agentId);
    const p = cycle.phases.find((x) => x.name === agentId);
    if (p) p.skills = ctx.skills.map((x) => x.id);
    return ctx;
  }

  /** Checks what the phase actually produced against the artefacts its skills say it owes. */
  handover(cycle, agentId) {
    const p = cycle.phases.find((x) => x.name === agentId);
    const h = checkHandover(agentId, producedBy(agentId, cycle), cycle.skills);
    if (p) p.handover = h;
    return h;
  }

  async startCycle({ type = 'baseline', name, baselineId, inputs = {}, sutBuild, reviewer, skills, testingType }) {
    if (!['baseline', 'incremental'].includes(type)) throw httpError(400, 'type must be "baseline" or "incremental"');
    let tt;
    try { tt = getTestingType(testingType); } catch (e) { throw httpError(400, e.message, [{ field: 'testingType', message: e.message }]); }
    let activeSkills;
    try { activeSkills = selectSkills(this.skills, skills, tt.id); } catch (e) { throw httpError(400, e.message); }
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
      testingType: tt.id,
      testingTypeName: tt.name,
      status: 'awaiting-review',
      createdAt: now(),
      createdBy: reviewer || null,
      baselineId: baseline ? baseline.id : null,
      baselineVersionAtStart: baseline ? baseline.version : null,
      sutBuild: sutBuild || codebase?.branch || DEFAULT_BUILD,
      inputs: loaded.map(({ statements: s, ...rest }) => ({ ...rest, statementCount: s.length })),
      normalisation,
      skills: activeSkills,
      phases: PHASES[type].map((p) => ({ name: p, label: PHASE_LABEL[p], status: 'pending' })),
      approvals: [],
      artifacts: {},
    };
    setPhase(cycle, 'ingest', 'done', `${loaded.length} input(s), ${statements.length} statements`);
    this.skillContext(cycle, 'normalise');
    this.handover(cycle, 'normalise');
    setPhase(cycle, 'normalise', 'done', `${normalisation.counts.agreed} agreed · ${normalisation.counts['jira-only']} Jira only · ${normalisation.counts['code-only']} code only · ${normalisation.counts.conflict} conflicts`);
    if (baseline) cycle.deltaPreview = this.previewDelta(cycle, {}, baseline);
    this.skillContext(cycle, 'review-agent');
    cycle.reviewAgent = reviewInputs({ normalisation, inputs: cycle.inputs, testingType: tt.id, deltaPreview: cycle.deltaPreview || null, baseline });
    this.handover(cycle, 'review-agent');
    const rc = cycle.reviewAgent.counts;
    setPhase(cycle, 'review-agent', 'done', `${rc.added} added · ${rc.missing} missing · ${rc.conflicts} conflicts suggested for the reviewer`);
    setPhase(cycle, 'review', 'waiting');
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
    if (cycle.status === 'awaiting-merge') {
      throw httpError(409, `The requirement set of ${cycle.id} is already approved. The step still open is the merge into baseline ${cycle.baselineId}: approve it on the merge screen.`, [{ gate: 'merge' }]);
    }
    if (cycle.status !== 'awaiting-review') throw httpError(409, `Cycle is ${cycle.status}, not awaiting review`);
    const open = cycle.normalisation.groups.filter((g) => g.bucket === 'conflict' && !excluded.includes(g.id) && !resolutions[g.id]);
    const missing = [
      ...(!reviewer || !String(reviewer).trim() ? [{ field: 'reviewer', message: 'Reviewer name is required: every approval is recorded against a person' }] : []),
      ...open.map((g) => ({ group: g.id, message: `Conflict ${g.id} needs a decision (${g.options.map((o) => `${o.sources.join('/')} says ${o.signature}`).join(', ')}): choose a value or exclude it` })),
    ];
    if (missing.length) {
      const head = open.length ? `Unresolved conflicts: ${open.map((g) => g.id).join(', ')}. ` : '';
      throw httpError(400, `${head}Cannot approve the requirement set yet: ${missing.map((m) => m.message).join('; ')}`, missing);
    }
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
    this.skillContext(cycle, 'requirements');
    setPhase(cycle, 'requirements', 'done', `${requirements.length} requirements`);
    const skills = Object.fromEntries(['rules', 'testcases', 'scripts'].map((a) => [a, this.skillContext(cycle, a)]));
    const out = design.designAgents(requirements, { cycle, counters, previous, skills, testingType: cycle.testingType });
    const count = (arr, st) => arr.filter((x) => x.status === st).length;
    const split = (arr) => (previous ? ` (${count(arr, 'new') + count(arr, 'added')} new · ${count(arr, 're-designed')} re-designed · ${count(arr, 'carried over')} carried over)` : '');
    const sel = out.selection;
    const scope = sel.notInRun ? ` · ${sel.inRun} in this ${sel.name.toLowerCase()} run` : '';
    setPhase(cycle, 'rules', 'done', `${out.rules.length} business rules${split(out.rules)}`);
    setPhase(cycle, 'testcases', 'done', `${out.testCases.length} test cases${split(out.testCases)}${scope}`);
    setPhase(cycle, 'scripts', 'done', `${out.scripts.length} Playwright specs${split(out.scripts)}`);
    cycle.artifacts = { ...cycle.artifacts, requirements, rules: out.rules, testCases: out.testCases, scripts: out.scripts, affected: out.affected, selection: sel };
    for (const a of ['requirements', 'rules', 'testcases', 'scripts']) this.handover(cycle, a);
  }

  async runBaseline(cycleId) {
    const cycle = this.mustGet(cycleId);
    cycle.counters = { req: 0, rule: 0, caseF: 0, caseN: 0 };
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
    this.store.saveCycle(done);
    await this.runReportPhase(done.id);
  }

  /** Report agent: test case export, comparison with the previous cycle (incremental), cycle report. */
  async runReportPhase(cycleId) {
    const cycle = this.mustGet(cycleId);
    setPhase(cycle, 'report', 'running');
    const ctx = this.skillContext(cycle, 'report');
    const dir = path.join(this.store.runDir(cycle.id), 'exports');
    fs.mkdirSync(dir, { recursive: true });
    const exp = await testCasesExport(cycle);
    const file = `${cycle.id}-test-cases.xlsx`;
    fs.writeFileSync(path.join(dir, file), exp.buffer);
    cycle.artifacts.exports = { ...(cycle.artifacts.exports || {}), testCases: { file: `exports/${file}`, columns: exp.columns, columnSource: exp.columnSource, rows: exp.rows, gaps: exp.gaps } };
    const prev = cycle.previousCycleId ? this.store.getCycle(cycle.previousCycleId) : null;
    if (cycle.type === 'incremental' && prev) {
      const cmp = compareCycles(prev, cycle);
      cycle.comparison = { a: cmp.a.id, b: cmp.b.id, generatedAt: cmp.generatedAt, requirements: cmp.requirements, testCases: cmp.testCases, scripts: cmp.scripts, execution: cmp.execution, defects: cmp.defects };
    }
    cycle.report = await buildCycleReport(cycle, { env: this.env, fetchImpl: this.fetchImpl, guidance: ctx.guidance });
    setPhase(cycle, 'report', 'done', 'Report generated');
    const h = this.handover(cycle, 'report');
    cycle.report.handovers = collectHandovers(cycle);
    cycle.report.handoverStatus = cycle.report.handovers.some((x) => x.status === 'incomplete') ? 'incomplete' : 'complete';
    if (h.status === 'incomplete') cycle.phases.find((x) => x.name === 'report').summary += ` · hand-over incomplete (${h.missing.join(', ')})`;
    this.store.saveCycle(cycle);
  }

  async runIncrementalDesign(cycleId) {
    const cycle = this.mustGet(cycleId);
    const baseline = this.store.getBaseline(cycle.baselineId);
    setPhase(cycle, 'delta', 'running');
    this.skillContext(cycle, 'delta');
    const delta = classifyDelta(baseline.requirements, cycle.reviewed);
    cycle.delta = delta;
    this.handover(cycle, 'delta');
    setPhase(cycle, 'delta', 'done', delta.summary);
    cycle.counters = clone(baseline.counters);
    const requirements = design.requirementsAgentIncremental(baseline.requirements, delta, { cycle, counters: cycle.counters });
    this.runDesignPhases(cycle, requirements, baseline);
    this.proposeMerge(cycle, baseline);
    setPhase(cycle, 'merge-approval', 'waiting');
    cycle.status = 'awaiting-merge';
    this.store.saveCycle(cycle);
  }

  proposeMerge(cycle, baseline) {
    const a = cycle.artifacts;
    cycle.mergeProposal = {
      baselineId: baseline.id,
      baselineVersion: baseline.version,
      requirements: a.requirements.filter((r) => ['new', 'enhanced'].includes(r.status)).map((r) => r.id),
      rules: a.rules.filter((r) => r.status !== 'carried over').map((r) => r.id),
      testCases: a.testCases.filter((t) => t.status !== 'carried over').map((t) => t.key),
      scripts: a.scripts.filter((s) => s.status !== 'carried over').map((s) => s.file),
    };
  }

  /**
   * Re-designs the addition without the rows the approver rejected: a rejected enhancement keeps the
   * baseline value, a rejected new requirement is dropped. Ids are unchanged (the id sequence is replayed).
   */
  withoutRejectedRows(cycle, baseline, rejected) {
    const items = cycle.delta.items
      .map((d) => (d.classification === 'enhanced' && rejected.includes(d.requirementId) ? { ...d, classification: 'unchanged', rejectedAtMerge: true } : d));
    cycle.counters = clone(baseline.counters);
    const requirements = design.requirementsAgentIncremental(baseline.requirements, { ...cycle.delta, items }, { cycle, counters: cycle.counters });
    this.runDesignPhases(cycle, requirements, baseline);
    const drop = new Set(rejected.filter((id) => !baseline.requirements.some((r) => r.id === id)));
    const a = cycle.artifacts;
    a.requirements = a.requirements.filter((r) => !drop.has(r.id));
    a.rules = a.rules.filter((r) => !drop.has(r.requirementId));
    a.testCases = a.testCases.filter((t) => !drop.has(t.requirementId));
    a.scripts = a.scripts.filter((x) => !drop.has(x.requirementId));
    for (const x of ['requirements', 'rules', 'testcases', 'scripts']) this.handover(cycle, x);
    this.proposeMerge(cycle, baseline);
  }

  decideMerge(cycleId, { decision, approver, comment = '', rejectedRows = [] }) {
    const cycle = this.mustGet(cycleId);
    if (cycle.status === 'awaiting-review') {
      throw httpError(409, `Approve the requirement set first: ${cycle.id} is still waiting at the review stage. The merge into baseline ${cycle.baselineId} comes after the design agents have run.`, [{ gate: 'review' }]);
    }
    if (cycle.status !== 'awaiting-merge') throw httpError(409, `Cycle is ${cycle.status}, not awaiting merge approval`);
    if (!approver || !String(approver).trim()) throw httpError(400, 'Approver name is required: every merge into the baseline is recorded against a person', [{ field: 'approver', message: 'Approver name is required' }]);
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
    const rejected = [].concat(rejectedRows || []);
    const unknown = rejected.filter((id) => !cycle.mergeProposal.requirements.includes(id));
    if (unknown.length) throw httpError(400, `Not a row of this merge: ${unknown.join(', ')}`);
    if (rejected.length && rejected.length === cycle.mergeProposal.requirements.length) throw httpError(400, 'Every row is rejected - reject the whole merge instead');
    if (rejected.length) {
      cycle.rejectedRows = rejected;
      this.withoutRejectedRows(cycle, baseline, rejected);
    }
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
      detail: `${cycle.mergeProposal.requirements.length} requirements, ${cycle.mergeProposal.testCases.length} test cases, ${cycle.mergeProposal.scripts.length} scripts merged: ${baseline.id} v${previousVersion} -> v${merged.version}${rejected.length ? `; rows rejected at the gate: ${rejected.join(', ')}` : ''}` });
    cycle.previousCycleId = baseline.lastCycleId;
    cycle.baselineVersionAfter = merged.version;
    setPhase(cycle, 'merge-approval', 'done', `Approved by ${approver}; ${baseline.id} is now v${merged.version}`);
    cycle.status = 'running';
    this.store.saveCycle(cycle);
    return this.track(cycle.id, this.finishIncremental(cycle.id, previousDefects));
  }

  async finishIncremental(cycleId, previousDefects) {
    await this.runExecutionPhases(cycleId, { previousDefects });
    const c = this.mustGet(cycleId);
    c.status = 'completed';
    c.completedAt = now();
    this.store.saveCycle(c);
    await this.runReportPhase(cycleId);
  }

  async runExecutionPhases(cycleId, { previousDefects }) {
    let cycle = this.mustGet(cycleId);
    setPhase(cycle, 'execution', 'running');
    this.skillContext(cycle, 'execution');
    this.store.saveCycle(cycle);
    const runCases = cycle.artifacts.testCases.filter((t) => t.inRun !== false);
    const runKeys = runCases.filter((t) => t.automation === 'Automated').map((t) => t.key);
    const partial = runCases.length !== cycle.artifacts.testCases.length;
    const execution = runKeys.length ? await executeSuite({
      scripts: cycle.artifacts.scripts.filter((x) => x.covers.some((k) => runKeys.includes(k))), testCases: runCases,
      runDir: this.store.runDir(cycle.id), sutBuild: cycle.sutBuild, keys: partial ? runKeys : null,
    }) : noAutomatedRun(runCases, cycle);
    execution.testingType = cycle.testingType;
    execution.notInRun = cycle.artifacts.testCases.length - runCases.length;
    cycle = this.mustGet(cycleId);
    cycle.artifacts.execution = execution;
    this.handover(cycle, 'execution');
    const s = execution.summary;
    setPhase(cycle, 'execution', 'done', `${s.executed} executed · ${s.passed} passed · ${s.failed} failed · ${s.notRun} not run (manual)${execution.notInRun ? ` · ${execution.notInRun} kept in the pack, outside this run` : ''}`);
    setPhase(cycle, 'defects', 'running');
    this.skillContext(cycle, 'defects');
    const { defects, resolved, nextNo } = raiseDefects({
      execution, testCases: cycle.artifacts.testCases, requirements: cycle.artifacts.requirements, cycle,
      previousDefects, startNo: this.store.meta().nextDefect,
    });
    this.store.bumpDefectCounter(nextNo);
    cycle.artifacts.defects = defects;
    cycle.artifacts.resolvedDefects = resolved;
    this.handover(cycle, 'defects');
    setPhase(cycle, 'defects', 'done', `${defects.length} defect(s) from real failures${resolved.length ? ` · ${resolved.length} resolved` : ''}`);
    cycle.artifacts.coverage = computeCoverage(cycle.artifacts.requirements, runCases, execution.results, cycle.inputs.find((i) => i.slot === 'codebase')?.dataModel);
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
    const baseline = this.store.getBaseline(cycle.baselineId);
    const prevCycleId = cycle.previousCycleId || baseline.cycles[baseline.cycles.length - 2];
    return this.track(cycle.id, this.finishIncremental(cycle.id, this.store.getCycle(prevCycleId)?.artifacts?.defects || []));
  }

  mustGet(id) {
    const c = this.store.getCycle(id);
    if (!c) throw httpError(404, `Cycle ${id} not found`);
    return c;
  }

  runDir(id) { return path.join(this.store.runDir(id)); }
}

function httpError(status, message, details) {
  const e = new Error(message);
  e.status = status;
  if (details) e.details = details;
  return e;
}

module.exports = { Pipeline, PHASES, PHASE_LABEL, httpError };
