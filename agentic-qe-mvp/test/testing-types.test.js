'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/server');
const { applyReview } = require('../src/normalise');
const design = require('../src/agents/design');
const { reviewInputs } = require('../src/agents/review');
const { buildLeadReport } = require('../src/lead-report');
const { PHASES } = require('../src/pipeline');
const { tmpDir, baselineCycle, incrementalDesign, BASELINE_INPUTS } = require('./helpers');

const inRunCases = (c) => c.artifacts.testCases.filter((t) => t.inRun);
const evidenceOf = (c) => c.artifacts.execution.results.flatMap((r) => r.evidence || []);

test('testing types are exposed in /api/meta, validated and persisted on the cycle', async () => {
  const ctx = createApp({ dataDir: tmpDir('tt-api'), env: {} });
  const server = ctx.app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (body) => { const r = await fetch(`${base}/api/cycles`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
  try {
    const meta = await (await fetch(`${base}/api/meta`)).json();
    assert.deepEqual(meta.testingTypes.map((t) => t.id), ['functional', 'e2e', 'regression', 'smoke', 'performance']);
    assert.ok(meta.testingTypes.every((t) => t.name && t.focus && t.baseline && t.incremental));
    assert.equal(meta.platform.reviewAgent.id, 'review-agent');
    assert.equal(meta.platform.agents.length, 7, 'the review agent is not one of the seven');
    const bad = await post({ type: 'baseline', testingType: 'load-soak', inputs: BASELINE_INPUTS });
    assert.equal(bad.status, 400);
    assert.match(bad.body.error, /testingType must be one of: functional, e2e, regression, smoke, performance/);
    const ok = await post({ type: 'baseline', testingType: 'smoke', inputs: BASELINE_INPUTS });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.testingType, 'smoke');
    assert.equal(ctx.store.getCycle(ok.body.id).testingType, 'smoke');
    const list = await (await fetch(`${base}/api/cycles`)).json();
    assert.equal(list.find((c) => c.id === ok.body.id).testingType, 'smoke');
    assert.ok(ok.body.skills.some((s) => s.id === 'testing-smoke') && !ok.body.skills.some((s) => s.id === 'testing-functional'), 'the type of testing picks its skill');
  } finally { server.close(); }
});

test('review agent runs before the human review, suggests added / missing / conflicting pieces and approves nothing', async () => {
  const { pipeline } = createApp({ dataDir: tmpDir('tt-ra'), env: {} });
  const c = await pipeline.startCycle({ type: 'baseline', testingType: 'functional', inputs: BASELINE_INPUTS });
  assert.deepEqual(PHASES.baseline.slice(0, 4), ['ingest', 'normalise', 'review-agent', 'review']);
  assert.equal(c.phases.find((p) => p.name === 'review-agent').status, 'done');
  assert.equal(c.phases.find((p) => p.name === 'review').status, 'waiting');
  assert.equal(c.status, 'awaiting-review');
  const ra = c.reviewAgent;
  assert.equal(ra.advisory, true);
  const conflict = ra.findings.find((f) => f.category === 'conflict');
  assert.match(conflict.title, /2 %/);
  assert.match(conflict.title, /1\.5 %/);
  assert.deepEqual([...new Set(conflict.sources.map((s) => s.source))].sort(), ['code', 'jira']);
  assert.ok(conflict.sources.every((s) => s.ref));
  assert.ok(ra.findings.some((f) => f.category === 'added' && /no Jira story/.test(f.title) && /404/.test(f.detail)));
  assert.ok(ra.findings.some((f) => f.category === 'missing' && /Jira/.test(f.title) && /[Cc]ancelled/.test(f.detail)));
  assert.ok(ra.findings.some((f) => /commission-driving attributes/.test(f.title)));
  assert.equal(ra.counts.conflicts, 1);
  assert.equal(c.normalisation.counts.conflict, 1, 'the review agent does not settle the conflict');
  assert.equal(c.review, undefined);
  assert.throws(() => pipeline.review(c.id, {}), /reviewer/i, 'the human review is still required');
});

test('performance testing never fabricates a target: the review agent and the design report the gap', async () => {
  const { pipeline } = createApp({ dataDir: tmpDir('tt-gap'), env: {} });
  const c = await pipeline.startCycle({ type: 'baseline', testingType: 'performance', inputs: BASELINE_INPUTS });
  const latency = c.normalisation.groups.find((g) => /300\s*ms/.test(g.text || ''));
  assert.ok(latency, 'the inputs state a latency target');
  assert.ok(!c.reviewAgent.findings.some((f) => /response-time target/.test(f.title)), 'no gap while the target is stated');
  const without = { ...c.normalisation, groups: c.normalisation.groups.filter((g) => g.id !== latency.id) };
  const ra = reviewInputs({ normalisation: without, inputs: c.inputs, testingType: 'performance' });
  assert.ok(ra.findings.some((f) => f.severity === 'high' && /response-time target/.test(f.title)));
  const conflict = c.normalisation.groups.find((g) => g.bucket === 'conflict');
  const reviewed = applyReview(c.normalisation, { excluded: [latency.id, conflict.id] });
  const counters = { req: 0, rule: 0, caseF: 0, caseN: 0 };
  const reqs = design.requirementsAgentBaseline(reviewed, { cycle: c, counters });
  const out = design.designAgents(reqs, { cycle: c, counters, testingType: 'performance' });
  assert.equal(out.selection.inRun, 0);
  assert.ok(out.selection.gaps.some((g) => g.kind === 'no-performance-target'));
});

test('functional: baseline designs, scripts and runs every functional case; incremental carries, re-designs and adds', async () => {
  const { pipeline, store } = createApp({ dataDir: tmpDir('tt-fn'), env: {} });
  const c1 = await baselineCycle(pipeline, store, { testingType: 'functional' });
  assert.equal(c1.status, 'completed');
  const run = inRunCases(c1);
  assert.ok(run.length >= 10);
  assert.ok(run.every((t) => t.type === 'functional' && t.suite === 'api'));
  assert.ok(!run.some((t) => t.ui || t.type === 'non-functional'), 'no screens or response times in a functional run');
  assert.ok(c1.artifacts.scripts.every((s) => /Type of testing: Functional testing/.test(s.code)));
  const ex = c1.artifacts.execution.summary;
  assert.equal(ex.executed, run.filter((t) => t.automation === 'Automated').length);
  assert.ok(ex.failed >= 1, 'the seeded 7-night defect is found');
  assert.equal(c1.report.testing.id, 'functional');

  const c2 = await incrementalDesign(pipeline, store, c1.baselineId, 'Priya Shah', 'functional');
  assert.equal(c2.status, 'awaiting-merge', 'the merge approval is still required');
  assert.equal(c2.artifacts.execution, undefined);
  const statuses = new Set(c2.artifacts.testCases.map((t) => t.status));
  for (const s of ['carried over', 're-designed', 'new']) assert.ok(statuses.has(s), s);
  const { done } = pipeline.decideMerge(c2.id, { decision: 'approve', approver: 'Sam Lee' });
  await done;
  const c3 = store.getCycle(c2.id);
  assert.equal(c3.status, 'completed');
  assert.ok(c3.artifacts.execution.summary.executed > ex.executed);
});

test('end-to-end: the run is user journeys through the advisor screen, with screenshots', async () => {
  const { pipeline, store } = createApp({ dataDir: tmpDir('tt-e2e'), env: {} });
  const c = await baselineCycle(pipeline, store, { testingType: 'e2e' });
  const run = inRunCases(c);
  assert.ok(run.length >= 3);
  assert.ok(run.every((t) => ['ui', 'journey'].includes(t.suite) && t.labels.includes('e2e')));
  assert.ok(run.some((t) => t.suite === 'journey' && /advisor/i.test(t.objective)));
  assert.ok(c.artifacts.selection.outOfScope.length > 0, 'requirements with no journey are listed as outside the run');
  assert.ok(evidenceOf(c).some((e) => e.contentType === 'image/png'));
  assert.equal(c.artifacts.execution.summary.executed, run.filter((t) => t.automation === 'Automated').length);
  assert.match(buildLeadReport(c).summary.join(' '), /End-to-end testing/);
});

test('smoke: a deliberately small critical path, never the full suite and never a release decision', async () => {
  const { pipeline, store } = createApp({ dataDir: tmpDir('tt-smoke'), env: {} });
  const c = await baselineCycle(pipeline, store, { testingType: 'smoke' });
  const run = inRunCases(c);
  assert.equal(run.length, 3);
  assert.ok(run.every((t) => t.labels.includes('smoke')));
  assert.ok(c.artifacts.execution.summary.executed <= 3);
  assert.ok(c.artifacts.selection.outOfScope.length > 0);
  assert.ok(buildLeadReport(c).risks.some((r) => /smoke run is not a release decision/.test(r)));
});

test('performance: latency and load checks from the stated target, with timing samples', async () => {
  const { pipeline, store } = createApp({ dataDir: tmpDir('tt-perf'), env: {} });
  const c = await baselineCycle(pipeline, store, { testingType: 'performance' });
  const run = inRunCases(c);
  assert.deepEqual([...new Set(run.map((t) => t.suite))].sort(), ['load', 'nfr']);
  assert.ok(run.every((t) => t.type === 'non-functional' && t.labels.includes('performance')));
  assert.ok(evidenceOf(c).some((e) => e.contentType === 'application/json' && /latency samples/.test(e.name)));
  assert.equal(c.report.testing.selection.gaps.length, 0);
});

test('regression: the incremental run reruns the reused pack as well as what changed', async () => {
  const { pipeline, store } = createApp({ dataDir: tmpDir('tt-reg'), env: {} });
  const c1 = await baselineCycle(pipeline, store, { testingType: 'regression' });
  const c2 = await incrementalDesign(pipeline, store, c1.baselineId, 'Priya Shah', 'regression');
  const sel = c2.artifacts.selection;
  assert.ok(sel.reused > 0 && sel.redesigned > 0);
  assert.ok(c2.artifacts.testCases.filter((t) => t.status === 'carried over').every((t) => t.inRun && t.labels.includes('regression')));
  const { done } = pipeline.decideMerge(c2.id, { decision: 'approve', approver: 'Sam Lee' });
  await done;
  const c3 = store.getCycle(c2.id);
  const carried = c3.artifacts.testCases.filter((t) => t.status === 'carried over' && t.automation === 'Automated').map((t) => t.key);
  const executed = new Set(c3.artifacts.execution.results.filter((r) => r.status !== 'not-run').map((r) => r.key));
  assert.ok(carried.length && carried.every((k) => executed.has(k)));
});
