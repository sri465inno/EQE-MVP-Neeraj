'use strict';
const { LEVELS } = require('./catalog');
// Runs the agents in order as a background job, persisting every state change so the dashboard can poll progress.
const store = require('./store');
const devinEngine = require('./devin/engine');

const STAGES = [
  { key: 'intake', name: 'Requirements intake', agent: 'Intake agent', run: require('./agents/intake') },
  { key: 'analysis', name: 'Requirements analysis', agent: 'Analysis agent', run: require('./agents/analysis') },
  { key: 'design', name: 'E2E test design', agent: 'Test design agent', run: require('./agents/design') },
  { key: 'review', name: 'Lead review', agent: 'Human approval gate', gate: true },
  { key: 'scripts', name: 'Script generation (MCP)', agent: 'Automation agent', run: require('./agents/scriptgen') },
  { key: 'execution', name: 'Execution', agent: 'Execution agent', run: require('./agents/execution') },
  { key: 'execreview', name: 'Execution review', agent: 'Human execution review gate', gate: true },
  { key: 'reporting', name: 'Reporting', agent: 'Reporting agent', run: require('./agents/reporting') },
];
const active = new Map(); // runId -> { cancelled, child }

function create(config) {
  const run = {
    id: store.nextId(), createdAt: new Date().toISOString(), status: 'queued', config,
    stages: STAGES.map(({ key, name, agent, gate }) => ({ key, name, agent, gate: !!gate, status: 'pending' })), log: [],
  };
  store.saveRun(run);
  setImmediate(() => advance(run.id));
  return run;
}

async function advance(id) {
  if (active.has(id)) return;
  const ctl = { cancelled: false, child: null };
  active.set(id, ctl);
  const run = store.getRun(id);
  let current;
  const log = (msg, level = 'info') => { run.log.push({ t: new Date().toISOString(), stage: current && current.key, level, msg }); store.saveRun(run); };
  try {
    run.status = 'running'; store.saveRun(run);
    for (const def of STAGES) {
      let st = run.stages.find((s) => s.key === def.key);
      if (!st) { st = { key: def.key, name: def.name, agent: def.agent, gate: !!def.gate, status: 'pending' }; run.stages.splice(STAGES.indexOf(def), 0, st); }
      if (st.status === 'done' || st.status === 'approved') continue;
      current = st;
      if (def.gate && def.key === 'execreview') {
        if (run.config.autoApprove) {
          const triaged = run.execution.results.some((r) => r.triage);
          const defects = run.execution.results.filter((r) => r.status === 'failed').map((r) => ({ tcId: r.tcId, raise: r.triage ? !!r.triage.raiseDefect : true,
            reason: r.triage && !r.triage.raiseDefect ? `AI triage: ${r.triage.category}${r.triage.rationale ? ` (${r.triage.rationale})` : ''}` : '' }));
          Object.assign(st, { status: 'approved', finishedAt: new Date().toISOString(), summary: triaged ? 'Auto-approved (run option): defects raised as Devin triaged them' : 'Auto-approved (run option): every failure raised as a defect' });
          run.execReview = { approvedBy: `${run.config.reviewer || 'EQE lead'} (auto-approved)`, approvedAt: st.finishedAt, defects, manual: [] };
          log('Execution results auto-approved by run option'); continue;
        }
        const manual = run.testCases.filter((c) => c.automation === 'Manual').length;
        Object.assign(st, { status: 'waiting', startedAt: new Date().toISOString(), summary: `${run.execution.failed} failed test(s) and ${manual} manual test case(s) waiting for the EQE lead` });
        run.status = 'awaiting-execution-review';
        log('Waiting for the EQE lead to review the execution results, decide on defects and record manual results', 'warn');
        return;
      }
      if (def.gate) {
        if (run.config.autoApprove) {
          Object.assign(st, { status: 'approved', finishedAt: new Date().toISOString(), summary: 'Auto-approved (run option)' });
          run.review = { approvedBy: `${run.config.reviewer || 'EQE lead'} (auto-approved)`, approvedAt: st.finishedAt, excluded: [] };
          log('Test cases auto-approved by run option'); continue;
        }
        Object.assign(st, { status: 'waiting', startedAt: new Date().toISOString(), summary: `${run.design.automation} automatable cases waiting for the EQE lead` });
        run.status = 'awaiting-approval';
        log('Waiting for the EQE lead to review and approve the test cases', 'warn');
        return;
      }
      Object.assign(st, { status: 'running', startedAt: new Date().toISOString(), progress: 0, progressNote: '' }); store.saveRun(run);
      log(`${def.agent} started`);
      const fn = run.config.engine === 'devin' ? devinEngine[def.key] : def.run;
      // Agents report how far they are (0-99); 100 is set when the agent finishes.
      const progress = (pct, note) => {
        const p = Math.max(st.progress || 0, Math.min(99, Math.round(pct)));
        if (p === st.progress && (!note || note === st.progressNote)) return;
        st.progress = p; if (note) st.progressNote = note; store.saveRun(run);
      };
      const summary = await fn(run, { log, progress, stage: def.key, isCancelled: () => ctl.cancelled, setChild: (c) => { ctl.child = c; } });
      if (ctl.cancelled) throw new Error('Cancelled by user');
      Object.assign(st, { status: 'done', finishedAt: new Date().toISOString(), summary, progress: 100, progressNote: '' });
      log(`${def.agent} finished: ${summary}`);
    }
    run.status = 'completed'; run.finishedAt = new Date().toISOString(); store.saveRun(run);
  } catch (e) {
    if (current) Object.assign(current, { status: 'failed', finishedAt: new Date().toISOString(), error: e.message });
    run.status = ctl.cancelled ? 'cancelled' : 'failed';
    log(`${current ? current.name : 'Pipeline'} ${ctl.cancelled ? 'cancelled' : 'failed'}: ${e.message}`, 'error');
  } finally { active.delete(id); }
}

function approve(id, { excluded = [], note = '', by }) {
  const run = store.getRun(id);
  by = by || run?.config.reviewer || 'EQE lead';
  if (!run || run.status !== 'awaiting-approval') throw Object.assign(new Error('Run is not waiting for approval'), { status: 409 });
  const st = run.stages.find((s) => s.key === 'review');
  const kept = run.testCases.filter((c) => c.automation === 'Automation' && !excluded.includes(c.id)).length;
  Object.assign(st, { status: 'approved', finishedAt: new Date().toISOString(), summary: `Approved by ${by}: ${kept} automatable cases${excluded.length ? `, ${excluded.length} excluded` : ''}` });
  run.review = { approvedBy: by, approvedAt: st.finishedAt, excluded, note };
  run.log.push({ t: st.finishedAt, stage: 'review', level: 'info', msg: st.summary + (note ? ` · "${note}"` : '') });
  store.saveRun(run);
  setImmediate(() => advance(id));
  return run;
}

function approveExecution(id, { note = '', defects = [], manual = [], by }) {
  const run = store.getRun(id);
  if (!run || run.status !== 'awaiting-execution-review') throw Object.assign(new Error('Run is not waiting for the execution review'), { status: 409 });
  by = by || run.config.reviewer || 'EQE lead';
  const st = run.stages.find((s) => s.key === 'execreview');
  const dec = run.execution.results.filter((r) => r.status === 'failed').map(({ tcId }) => {
    const d = defects.find((x) => x.tcId === tcId) || {};
    return { tcId, raise: d.raise !== false, reason: String(d.reason || '').trim() };
  });
  const man = run.testCases.filter((c) => c.automation === 'Manual').map(({ id: tcId }) => {
    const m = manual.find((x) => x.tcId === tcId) || {};
    const status = ['passed', 'failed'].includes(m.status) ? m.status : 'not run';
    return { tcId, status, comment: String(m.comment || '').trim(), raiseDefect: status === 'failed' && !!m.raiseDefect };
  });
  const n = (k) => man.filter((m) => m.status === k).length;
  const raise = dec.filter((d) => d.raise).length + man.filter((m) => m.raiseDefect).length;
  Object.assign(st, { status: 'approved', finishedAt: new Date().toISOString(),
    summary: `Approved by ${by}: ${raise} defect(s) to raise${dec.some((d) => !d.raise) ? `, ${dec.filter((d) => !d.raise).length} not raised` : ''} · manual ${n('passed')} passed, ${n('failed')} failed, ${n('not run')} not run` });
  run.execReview = { approvedBy: by, approvedAt: st.finishedAt, note, defects: dec, manual: man };
  run.log.push({ t: st.finishedAt, stage: 'execreview', level: 'info', msg: st.summary + (note ? ` · "${note}"` : '') });
  store.saveRun(run);
  setImmediate(() => advance(id));
  return run;
}

function addTestCase(id, body = {}) {
  const run = store.getRun(id);
  if (!run || run.status !== 'awaiting-approval') throw Object.assign(new Error('Test cases can be added only while the cycle waits for review'), { status: 409 });
  const bad = (m) => Object.assign(new Error(m), { status: 400 });
  const title = String(body.title || '').trim();
  const acById = Object.fromEntries(run.analysis.stories.flatMap((s) => s.acs).map((a) => [a.id, a]));
  const acIds = [...new Set(body.acIds || [])].filter((a) => acById[a]);
  const steps = (body.steps || []).map((x) => ({ action: String(x.action || '').trim(), expected: String(x.expected || '').trim() })).filter((x) => x.action);
  if (!title) throw bad('Enter a test case title');
  if (!acIds.length) throw bad('Link at least one acceptance criterion');
  if (!steps.length) throw bad('Enter at least one step');
  const n = Math.max(0, ...run.testCases.map((t) => Number(t.id.split('-')[1]) || 0)) + 1;
  const by = run.config.reviewer || 'EQE lead';
  const tc = {
    id: `TC-${String(n).padStart(3, '0')}`, title, type: String(body.type || 'Functional'), automation: 'Manual', technique: 'user-defined',
    steps: steps.map((x, i) => ({ kind: 'manual', ...x, n: i + 1 })), preconditions: String(body.preconditions || '').trim(), data: {},
    storyKeys: [...new Set(acIds.map((a) => acById[a].storyKey))], acIds, priority: ['P1', 'P2', 'P3'].includes(body.priority) ? body.priority : 'P2',
    origin: 'user', level: LEVELS.user, createdBy: by, createdAt: new Date().toISOString(),
  };
  run.testCases.push(tc);
  const d = run.design; const covered = new Set(run.testCases.flatMap((c) => c.acIds));
  Object.assign(d, { total: run.testCases.length, manual: run.testCases.filter((c) => c.automation === 'Manual').length, acCovered: covered.size,
    acCoverage: Math.round((covered.size / (d.acTotal || 1)) * 1000) / 10, uncovered: Object.keys(acById).filter((a) => !covered.has(a)) });
  run.log.push({ t: tc.createdAt, stage: 'review', level: 'info', msg: `${tc.id} [Manual · User Defined] ${tc.title} → ${acIds.join(', ')} · added by ${by}` });
  store.saveRun(run);
  return run;
}

function reject(id, { reason = '', by }) {
  const run = store.getRun(id);
  if (!run || run.status !== 'awaiting-approval') throw Object.assign(new Error('Run is not waiting for approval'), { status: 409 });
  by = by || run.config.reviewer || 'EQE lead';
  const st = run.stages.find((s) => s.key === 'review');
  Object.assign(st, { status: 'failed', finishedAt: new Date().toISOString(), summary: `Requirement set rejected by ${by}`, error: `Rejected by ${by}${reason ? `: ${reason}` : ''}` });
  run.status = 'rejected'; run.finishedAt = st.finishedAt;
  run.review = { rejectedBy: by, rejectedAt: st.finishedAt, reason };
  run.log.push({ t: st.finishedAt, stage: 'review', level: 'error', msg: `Requirement set rejected by ${by}${reason ? `: "${reason}"` : ''}. Fix the stories in Jira and start a new run.` });
  store.saveRun(run);
  return run;
}

function rerunExecution(id, { slowMo = false } = {}) {
  const run = store.getRun(id);
  if (!run || !run.scripts || active.has(id) || !['completed', 'failed'].includes(run.status)) throw Object.assign(new Error('Execution can be re-run only on a finished cycle with automation scripts'), { status: 409 });
  for (const k of ['execution', 'execreview', 'reporting']) { const st = run.stages.find((s) => s.key === k); if (st) Object.assign(st, { status: 'pending', summary: undefined, error: undefined, startedAt: undefined, finishedAt: undefined }); }
  delete run.execReview;
  if (run.devin) run.devin.localRerun = true;
  run.config.slowMo = !!slowMo; run.status = 'queued'; delete run.finishedAt;
  run.log.push({ t: new Date().toISOString(), stage: 'execution', level: 'info', msg: `Execution re-run requested${slowMo ? ' in slow motion' : ''}` });
  store.saveRun(run);
  setImmediate(() => advance(id));
  return run;
}

function cancel(id) {
  const ctl = active.get(id);
  const run = store.getRun(id);
  if (!run) return null;
  if (run.devin?.sessionId && !['completed', 'failed', 'cancelled', 'rejected'].includes(run.status)) {
    devinEngine.send(run, 'EQE-CANCEL: the EQE lead cancelled this cycle. Stop now and finish with phase "failed" and error "Cancelled".', () => {}).catch(() => {});
  }
  if (ctl) { ctl.cancelled = true; if (ctl.child) ctl.child.kill('SIGTERM'); return run; }
  if (['awaiting-approval', 'awaiting-execution-review', 'queued'].includes(run.status)) {
    run.status = 'cancelled';
    const st = run.stages.find((s) => s.status === 'waiting'); if (st) st.status = 'failed';
    run.log.push({ t: new Date().toISOString(), level: 'error', msg: 'Run cancelled by user' });
    store.saveRun(run);
  }
  return run;
}

// Runs interrupted by a server restart cannot resume mid-agent.
function recover() {
  for (const r of store.listRuns()) {
    if (['running', 'queued'].includes(r.status)) {
      const run = store.getRun(r.id);
      // A Devin cycle keeps running in its session, so the dashboard reconnects instead of failing it.
      if (run.devin?.sessionId && !run.devin.localRerun) {
        run.status = 'queued';
        const st = run.stages.find((s) => s.status === 'running'); if (st) st.status = 'pending';
        run.log.push({ t: new Date().toISOString(), level: 'warn', msg: `Dashboard restarted: reconnecting to Devin session ${run.devin.url}` });
        store.saveRun(run); setImmediate(() => advance(run.id)); continue;
      }
      run.status = 'failed';
      const st = run.stages.find((s) => s.status === 'running'); if (st) Object.assign(st, { status: 'failed', error: 'Interrupted by a dashboard restart' });
      run.log.push({ t: new Date().toISOString(), level: 'error', msg: 'Interrupted by a dashboard restart' });
      store.saveRun(run);
    }
  }
}
module.exports = { STAGES, create, approve, approveExecution, addTestCase, reject, rerunExecution, cancel, recover, isActive: (id) => active.has(id), activeIds: () => [...active.keys()] };
