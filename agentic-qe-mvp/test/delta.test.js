'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadInputs } = require('../src/inputs');
const { normalise, applyReview } = require('../src/normalise');
const { classifyDelta } = require('../src/delta');
const design = require('../src/agents/design');
const { BASELINE_INPUTS, INCREMENT_INPUTS } = require('./helpers');

async function setup() {
  const base = await loadInputs(BASELINE_INPUTS, ['initiative', 'epic', 'codebase'], { env: {} });
  const bn = normalise(base.flatMap((i) => i.statements));
  const conflict = bn.groups.find((g) => g.bucket === 'conflict');
  const reviewed = applyReview(bn, { resolutions: { [conflict.id]: conflict.options.find((o) => o.signature === '1.5 %').optionId } });
  const counters = { req: 0, rule: 0, case: 0 };
  const c1 = { id: 'CYC-1', name: 'Cycle 1' };
  const requirements = design.requirementsAgentBaseline(reviewed, { cycle: c1, counters });
  const d1 = design.designAgents(requirements, { cycle: c1, counters });
  const baseline = { requirements, ...d1 };
  const inc = await loadInputs(INCREMENT_INPUTS, ['epic', 'codebase'], { env: {} });
  const incoming = applyReview(normalise(inc.flatMap((i) => i.statements)), {});
  return { baseline, incoming, counters };
}

test('delta classification yields all three buckets and keeps the superseded value', async () => {
  const { baseline, incoming } = await setup();
  const d = classifyDelta(baseline.requirements, incoming);
  assert.ok(d.counts.unchanged > 0 && d.counts.enhanced > 0 && d.counts.new > 0, d.summary);
  assert.equal(d.counts.unchanged + d.counts.enhanced + d.counts.new, incoming.length, 'every incoming statement is classified');
  assert.equal(d.summary, `${d.counts.unchanged} unchanged · ${d.counts.enhanced} enhanced · ${d.counts.new} new`);
  const enhanced = d.items.filter((i) => i.classification === 'enhanced');
  assert.equal(enhanced.length, 1);
  assert.match(enhanced[0].incoming.text, /capped at USD 750/);
  assert.match(enhanced[0].previous.text, /capped at USD 500/);
  assert.ok(enhanced[0].baselineRequirementId);
  const newTexts = d.items.filter((i) => i.classification === 'new').map((i) => i.incoming.text).join(' | ');
  assert.match(newTexts, /10 or more rooms .* flat 8%/);
  assert.match(newTexts, /70% of the package price/);
  assert.match(newTexts, /rate plan CORP.*flat 5%/);
  assert.equal(d.summary, '10 unchanged · 1 enhanced · 3 new');
  for (const u of d.items.filter((i) => i.classification === 'unchanged')) assert.ok(u.baselineRequirementId);
});

test('an enhanced value propagates into test case text and script assertions; unchanged are carried over', async () => {
  const { baseline, incoming, counters } = await setup();
  const d = classifyDelta(baseline.requirements, incoming);
  const cyc = { id: 'CYC-2', name: 'Cycle 2' };
  const reqs = design.requirementsAgentIncremental(baseline.requirements, d, { cycle: cyc, counters });
  const sla = reqs.find((r) => /Commission per reservation is capped/.test(r.text));
  assert.equal(sla.status, 'enhanced');
  assert.match(sla.text, /USD 750/);
  assert.match(sla.previous.text, /USD 500/);
  const out = design.designAgents(reqs, { cycle: cyc, counters, previous: baseline });
  const tc = out.testCases.find((t) => t.requirementId === sla.id);
  assert.equal(tc.status, 're-designed');
  assert.match(tc.name, /USD 750/);
  assert.match(tc.expected, /commission USD 750\.00/);
  assert.doesNotMatch(tc.expected, /500/);
  assert.match(tc.previous.expected, /commission USD 500\.00/);
  const script = out.scripts.find((s) => s.requirementId === sla.id);
  assert.equal(script.status, 're-designed');
  assert.match(script.code, /expect\(r\.body\.commission\)\.toBe\(750\);/);
  assert.doesNotMatch(script.code, /toBe\(500\)/);
  assert.match(script.previous.code, /expect\(r\.body\.commission\)\.toBe\(500\);/);
  const oldScripts = new Map(baseline.scripts.map((s) => [s.file, s]));
  for (const s of out.scripts.filter((x) => x.status === 'carried over')) assert.equal(s.code, oldScripts.get(s.file).code, `${s.file} carried over untouched`);
  const oldCases = new Map(baseline.testCases.map((t) => [t.key, t]));
  const content = (t) => ({ name: t.name, objective: t.objective, precondition: t.precondition, steps: t.steps, testData: t.testData, expected: t.expected, version: t.version, scriptFile: t.scriptFile });
  for (const t of out.testCases.filter((x) => x.status === 'carried over')) assert.deepEqual(content(t), content(oldCases.get(t.key)), `${t.key} carried over untouched`);
  const unchangedReqIds = new Set(reqs.filter((r) => r.status === 'unchanged').map((r) => r.id));
  assert.ok(out.testCases.filter((t) => unchangedReqIds.has(t.requirementId)).every((t) => t.status === 'carried over'));
  assert.ok(out.testCases.some((t) => t.status === 'new'));
});
