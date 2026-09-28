'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadInputs } = require('../src/inputs');
const { normalise, applyReview } = require('../src/normalise');
const { jiraLiveConfig, loadJiraIssue } = require('../src/connectors/jira');
const { BASELINE_INPUTS } = require('./helpers');

async function baselineStatements() {
  const inputs = await loadInputs(BASELINE_INPUTS, ['initiative', 'epic', 'codebase'], { env: {} });
  return { inputs, statements: inputs.flatMap((i) => i.statements) };
}

test('three inputs are ingested from recorded fixtures and labelled honestly', async () => {
  const { inputs } = await baselineStatements();
  assert.deepEqual(inputs.map((i) => i.slot), ['initiative', 'epic', 'codebase']);
  for (const i of inputs) {
    assert.equal(i.provenance.kind, 'fixture');
    assert.match(i.provenance.label, /no live (Jira|GitHub) call was made/);
    assert.ok(i.statements.length > 0);
  }
  assert.equal(inputs[0].ref, 'SWB-1');
  assert.equal(inputs[1].ref, 'SWB-10');
  assert.match(inputs[2].ref, /staywell\/booking-service@main/);
});

test('Jira is only called live when all three credentials are set', async () => {
  assert.equal(jiraLiveConfig({}), null);
  assert.equal(jiraLiveConfig({ JIRA_BASE_URL: 'https://x.atlassian.net', JIRA_EMAIL: 'a@b.c' }), null);
  const cfg = jiraLiveConfig({ JIRA_BASE_URL: 'https://x.atlassian.net/', JIRA_EMAIL: 'a@b.c', JIRA_API_TOKEN: 't' });
  assert.equal(cfg.baseUrl, 'https://x.atlassian.net');
  const fixtureIssue = require('../fixtures/jira/SWB-1.json');
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push({ url, auth: opts.headers.Authorization }); return { ok: true, status: 200, json: async () => fixtureIssue }; };
  const live = await loadJiraIssue('SWB-1', { env: { JIRA_BASE_URL: 'https://x.atlassian.net', JIRA_EMAIL: 'a@b.c', JIRA_API_TOKEN: 't' }, fetchImpl });
  assert.equal(live.provenance.kind, 'live');
  assert.match(calls[0].url, /^https:\/\/x\.atlassian\.net\/rest\/api\/3\/issue\/SWB-1/);
  assert.match(calls[0].auth, /^Basic /);
  const rec = await loadJiraIssue('SWB-1', { env: {}, fetchImpl: () => { throw new Error('must not call'); } });
  assert.equal(rec.provenance.kind, 'fixture');
});

test('normalisation shows Jira-only, code-only and an unresolved 15% vs 20% conflict', async () => {
  const { statements } = await baselineStatements();
  const n = normalise(statements);
  assert.equal(n.counts.statements, statements.length);
  assert.ok(n.counts['jira-only'] >= 1, 'has Jira-only statements');
  assert.ok(n.counts['code-only'] >= 1, 'has code-only statements');
  assert.equal(n.counts.conflict, 1);
  const conflict = n.groups.find((g) => g.bucket === 'conflict');
  assert.deepEqual(conflict.options.map((o) => o.signature).sort(), ['15 %', '20 %']);
  assert.deepEqual(conflict.options.find((o) => o.signature === '15 %').sources, ['jira']);
  assert.deepEqual(conflict.options.find((o) => o.signature === '20 %').sources, ['code']);
  assert.equal(conflict.resolution ?? null, null, 'conflict is left unresolved');
  const jiraOnly = n.groups.filter((g) => g.bucket === 'jira-only').map((g) => g.text).join(' | ');
  const codeOnly = n.groups.filter((g) => g.bucket === 'code-only').map((g) => g.text).join(' | ');
  assert.match(jiraOnly, /800 ms/);
  assert.match(codeOnly, /409/);
  assert.equal(normalise(statements).groups.map((g) => g.bucket).join(), n.groups.map((g) => g.bucket).join(), 'deterministic');
});

test('the reviewed set requires every conflict to be settled and honours exclusions', async () => {
  const { statements } = await baselineStatements();
  const n = normalise(statements);
  const conflict = n.groups.find((g) => g.bucket === 'conflict');
  assert.throws(() => applyReview(n, {}), /conflict/i);
  const jira15 = conflict.options.find((o) => o.signature === '15 %');
  const reviewed = applyReview(n, { resolutions: { [conflict.id]: jira15.optionId } });
  const fee = reviewed.find((r) => r.groupId === conflict.id);
  assert.match(fee.text, /15%/);
  const agreed = n.groups.find((g) => g.bucket === 'agreed');
  const withExclusion = applyReview(n, { excluded: [conflict.id, agreed.id] });
  assert.equal(withExclusion.length, n.groups.length - 2);
  assert.ok(!withExclusion.some((r) => r.groupId === agreed.id));
});
