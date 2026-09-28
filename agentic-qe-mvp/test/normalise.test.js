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
  assert.equal(inputs[0].ref, 'COM-1');
  assert.equal(inputs[1].ref, 'COM-10');
  assert.match(inputs[2].ref, /sri465inno\/uc-agentic-quality-engineering@demo\/commission-engine \(df5203e\)/);
  assert.equal(inputs[2].dataModel.attributeCount, 1000);
});

test('Jira is only called live when all three credentials are set', async () => {
  assert.equal(jiraLiveConfig({}), null);
  assert.equal(jiraLiveConfig({ JIRA_BASE_URL: 'https://x.atlassian.net', JIRA_EMAIL: 'a@b.c' }), null);
  const cfg = jiraLiveConfig({ JIRA_BASE_URL: 'https://x.atlassian.net/', JIRA_EMAIL: 'a@b.c', JIRA_API_TOKEN: 't' });
  assert.equal(cfg.baseUrl, 'https://x.atlassian.net');
  const fixtureIssue = require('../fixtures/jira/COM-1.json');
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push({ url, auth: opts.headers.Authorization }); return { ok: true, status: 200, json: async () => fixtureIssue }; };
  const live = await loadJiraIssue('COM-1', { env: { JIRA_BASE_URL: 'https://x.atlassian.net', JIRA_EMAIL: 'a@b.c', JIRA_API_TOKEN: 't' }, fetchImpl });
  assert.equal(live.provenance.kind, 'live');
  assert.match(calls[0].url, /^https:\/\/x\.atlassian\.net\/rest\/api\/3\/issue\/COM-1/);
  assert.match(calls[0].auth, /^Basic /);
  const rec = await loadJiraIssue('COM-1', { env: {}, fetchImpl: () => { throw new Error('must not call'); } });
  assert.equal(rec.provenance.kind, 'fixture');
});

test('normalisation shows Jira-only, code-only and an unresolved 2% vs 1.5% GDS uplift conflict', async () => {
  const { statements } = await baselineStatements();
  const n = normalise(statements);
  assert.equal(n.counts.statements, statements.length);
  assert.ok(n.counts['jira-only'] >= 1, 'has Jira-only statements');
  assert.ok(n.counts['code-only'] >= 1, 'has code-only statements');
  assert.equal(n.counts.conflict, 1);
  const conflict = n.groups.find((g) => g.bucket === 'conflict');
  assert.deepEqual(conflict.options.map((o) => o.signature).sort(), ['1.5 %', '2 %']);
  assert.deepEqual(conflict.options.find((o) => o.signature === '2 %').sources, ['jira']);
  assert.deepEqual(conflict.options.find((o) => o.signature === '1.5 %').sources, ['code']);
  assert.ok(conflict.options.every((o) => /GDS/.test(o.text)));
  assert.equal(conflict.resolution ?? null, null, 'conflict is left unresolved');
  const jiraOnly = n.groups.filter((g) => g.bucket === 'jira-only').map((g) => g.text).join(' | ');
  const codeOnly = n.groups.filter((g) => g.bucket === 'code-only').map((g) => g.text).join(' | ');
  assert.match(jiraOnly, /300 ms/);
  assert.match(jiraOnly, /Cancelled and no-show/);
  assert.match(codeOnly, /IATA number returns HTTP 422/);
  const agreed = n.groups.filter((g) => g.bucket === 'agreed').map((g) => g.text).join(' | ');
  assert.match(agreed, /1000 attributes/);
  assert.match(agreed, /capped at USD 500/);
  assert.match(agreed, /7 nights or more/);
  assert.equal(normalise(statements).groups.map((g) => g.bucket).join(), n.groups.map((g) => g.bucket).join(), 'deterministic');
});

test('the reviewed set requires every conflict to be settled and honours exclusions', async () => {
  const { statements } = await baselineStatements();
  const n = normalise(statements);
  const conflict = n.groups.find((g) => g.bucket === 'conflict');
  assert.throws(() => applyReview(n, {}), /conflict/i);
  const jira2 = conflict.options.find((o) => o.signature === '2 %');
  const reviewed = applyReview(n, { resolutions: { [conflict.id]: jira2.optionId } });
  const gds = reviewed.find((r) => r.groupId === conflict.id);
  assert.match(gds.text, /additional 2% channel uplift/);
  const agreed = n.groups.find((g) => g.bucket === 'agreed');
  const withExclusion = applyReview(n, { excluded: [conflict.id, agreed.id] });
  assert.equal(withExclusion.length, n.groups.length - 2);
  assert.ok(!withExclusion.some((r) => r.groupId === agreed.id));
});
