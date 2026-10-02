'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/server');
const { raiseDefectsInJira, storyOf, jiraDefectText } = require('../src/connectors/jira-defects');
const { computeTraceability, jiraItems } = require('../src/traceability');
const { tmpDir } = require('./helpers');

const LIVE = { JIRA_BASE_URL: 'https://x.atlassian.net', JIRA_EMAIL: 'a@b.c', JIRA_API_TOKEN: 't' };
const INPUTS = [
  { slot: 'epic', ref: 'AQPI-32', summary: 'Release 2.0 changes', hierarchy: [{ key: 'AQPI-32', summary: 'Release 2.0 changes', children: [{ key: 'AQPI-34', summary: 'Limit Paris stays to 14 nights' }, { key: 'AQPI-35', summary: 'Allow up to 5 resends' }] }] },
  { slot: 'codebase', ref: 'demo/hotel-booking-platform-v2' },
];
const defect = () => ({ id: 'DEF-001', title: 'A 15-night Paris stay returns 200 instead of 400', severity: 'Medium', testCaseKey: 'TC-F-122', ruleId: 'BR-126', requirementId: 'REQ-126',
  requirementText: 'Paris allows at most 14 nights.', jiraKeys: ['AQPI-32', 'AQPI-34'], expected: '400', actual: '200', assertion: 'expect(r.status).toBe(400);', scriptFile: 'br-126.spec.js' });
const cycle = { id: 'CYC-4', name: 'Hotel release 2.0', inputs: INPUTS };

function fakeJira(types) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    const body = opts.body ? JSON.parse(opts.body) : null;
    calls.push({ method: opts.method, path: url.replace(LIVE.JIRA_BASE_URL, ''), body });
    if (url.includes('/createmeta/')) return { ok: true, status: 200, text: async () => JSON.stringify({ issueTypes: types }) };
    if (url.endsWith('/rest/api/3/issue')) return { ok: true, status: 201, text: async () => JSON.stringify({ key: 'AQPI-37' }) };
    return { ok: true, status: 201, text: async () => '' };
  };
  return { calls, fetchImpl };
}

test('a defect links to the most specific Jira item: the story, not its epic', () => {
  assert.equal(storyOf(defect(), jiraItems(INPUTS)), 'AQPI-34');
});

test('without Jira credentials the defect is not raised in Jira but keeps its story link and a ready payload', async () => {
  const [d] = await raiseDefectsInJira([defect()], { cycle, env: {}, fetchImpl: () => { throw new Error('must not call'); }, items: jiraItems(INPUTS) });
  assert.equal(d.jira.status, 'not raised');
  assert.equal(d.jira.linkedTo, 'AQPI-34');
  assert.equal(d.jira.payload.fields.project.key, 'AQPI');
  assert.match(d.jira.payload.fields.summary, /^\[DEF-001\]/);
  assert.match(jiraDefectText(d), /not raised in Jira; linked to AQPI-34/);
});

test('a project without a Bug type gets the defect as a sub-task of the story', async () => {
  const { calls, fetchImpl } = fakeJira([{ id: '1', name: 'Task', subtask: false }, { id: '2', name: 'Sub-task', subtask: true }]);
  const [d] = await raiseDefectsInJira([defect()], { cycle, env: LIVE, fetchImpl, items: jiraItems(INPUTS) });
  const create = calls.find((c) => c.method === 'POST' && c.path === '/rest/api/3/issue');
  assert.deepEqual(create.body.fields.parent, { key: 'AQPI-34' });
  assert.equal(create.body.fields.issuetype.id, '2');
  assert.ok(!calls.some((c) => c.path === '/rest/api/3/issueLink'));
  assert.deepEqual({ status: d.jira.status, key: d.jira.key, link: d.jira.link, linkedTo: d.jira.linkedTo, url: d.jira.url },
    { status: 'raised', key: 'AQPI-37', link: 'sub-task of', linkedTo: 'AQPI-34', url: 'https://x.atlassian.net/browse/AQPI-37' });
});

test('a project with a Bug type gets a Bug linked to the story, and a still-open defect gets a comment, not a new issue', async () => {
  const { calls, fetchImpl } = fakeJira([{ id: '1', name: 'Task', subtask: false }, { id: '9', name: 'Bug', subtask: false }]);
  const [d] = await raiseDefectsInJira([defect()], { cycle, env: LIVE, fetchImpl, items: jiraItems(INPUTS) });
  assert.equal(calls.find((c) => c.path === '/rest/api/3/issue').body.fields.issuetype.id, '9');
  assert.deepEqual(calls.find((c) => c.path === '/rest/api/3/issueLink').body, { type: { name: 'Relates' }, inwardIssue: { key: 'AQPI-37' }, outwardIssue: { key: 'AQPI-34' } });
  assert.equal(d.jira.link, 'relates to');
  const again = fakeJira([]);
  const [d2] = await raiseDefectsInJira([{ ...defect(), jira: d.jira }], { cycle: { ...cycle, id: 'CYC-5' }, env: LIVE, fetchImpl: again.fetchImpl, items: jiraItems(INPUTS) });
  assert.deepEqual(again.calls.map((c) => c.path), ['/rest/api/3/issue/AQPI-37/comment']);
  assert.equal(d2.jira.key, 'AQPI-37');
  assert.equal(d2.jira.updatedInCycle, 'CYC-5');
});

test('a failed Jira call is recorded on the defect instead of failing the cycle', async () => {
  const fetchImpl = async () => ({ ok: false, status: 403 });
  const [d] = await raiseDefectsInJira([defect()], { cycle, env: LIVE, fetchImpl, items: jiraItems(INPUTS) });
  assert.equal(d.jira.status, 'failed');
  assert.match(d.jira.reason, /HTTP 403/);
});

test('traceability runs from the Jira story through requirement, rule, test case, data, script and result to the defect', () => {
  const t = computeTraceability({
    inputs: INPUTS,
    artifacts: {
      requirements: [{ id: 'REQ-126', text: 'Paris allows at most 14 nights.', status: 'enhanced', jiraKeys: ['AQPI-34'] }, { id: 'REQ-130', text: 'Up to 5 resends.', status: 'enhanced', jiraKeys: ['AQPI-35'] }],
      testCases: [{ key: 'TC-F-122', name: '15-night Paris stay', requirementId: 'REQ-126', ruleId: 'BR-126', type: 'functional', automation: 'Automated', sourceRefs: ['AQPI-34'] },
        { key: 'TC-F-130', name: 'Sixth resend', requirementId: 'REQ-130', ruleId: 'BR-130', type: 'functional', automation: 'Automated', sourceRefs: ['AQPI-35'] }],
      testData: [{ id: 'TD-F-122', testCaseKey: 'TC-F-122' }, { id: 'TD-F-130', testCaseKey: 'TC-F-130' }],
      scripts: [{ file: 'br-126.spec.js', covers: ['TC-F-122'] }, { file: 'br-130.spec.js', covers: ['TC-F-130'] }],
      execution: { results: [{ key: 'TC-F-122', status: 'failed' }, { key: 'TC-F-130', status: 'passed' }] },
      defects: [{ ...defect(), jira: { key: 'AQPI-37' } }],
    },
  });
  const row = t.rows.find((r) => r.testCaseKey === 'TC-F-122');
  assert.deepEqual({ jira: row.jiraKeys, req: row.requirementId, rule: row.ruleId, data: row.testDataId, script: row.scriptFile, result: row.result, defects: row.defects, jiraDefects: row.jiraDefects },
    { jira: ['AQPI-34'], req: 'REQ-126', rule: 'BR-126', data: 'TD-F-122', script: 'br-126.spec.js', result: 'failed', defects: ['DEF-001'], jiraDefects: ['AQPI-37'] });
  const byKey = Object.fromEntries(t.stories.map((s) => [s.key, s]));
  assert.equal(byKey['AQPI-34'].status, 'failing');
  assert.equal(byKey['AQPI-34'].parent, 'AQPI-32');
  assert.equal(byKey['AQPI-35'].status, 'verified');
  assert.equal(byKey['AQPI-32'].status, 'not covered');
  assert.deepEqual(t.totals, { jiraItems: 3, covered: 2, verified: 1, failing: 1, testCases: 2, withData: 2, withScript: 2, executed: 2 });
});

test('an enterprise skill can be uploaded, is offered to the agents, and can be removed; bad or clashing skills are refused', async () => {
  const { app, pipeline } = createApp({ dataDir: tmpDir('skills-upload'), env: {} });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body) => fetch(`${base}/api/skills`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const skill = (id) => `---\nid: ${id}\nname: Acme defect standard\ndescription: Acme rules for defects.\nappliesTo: [defects]\n---\nEvery defect names its story.`;
  try {
    const ok = await post({ fileName: 'acme.md', text: skill('acme-defects') });
    assert.equal(ok.status, 201);
    assert.equal((await ok.json()).skill.source, 'enterprise upload');
    const meta = await (await fetch(`${base}/api/meta`)).json();
    assert.ok(meta.skills.some((s) => s.id === 'acme-defects' && s.source === 'enterprise upload'));
    assert.ok(pipeline.skills.some((s) => s.id === 'acme-defects'));
    assert.equal((await post({ text: 'no front matter' })).status, 400);
    assert.equal((await post({ text: skill('defect-reporting') })).status, 409);
    assert.equal((await post({ text: skill('x').replace('[defects]', '[nobody]') })).status, 400);
    assert.equal((await fetch(`${base}/api/skills/defect-reporting`, { method: 'DELETE' })).status, 409);
    assert.equal((await fetch(`${base}/api/skills/acme-defects`, { method: 'DELETE' })).status, 200);
    assert.ok(!pipeline.skills.some((s) => s.id === 'acme-defects'));
  } finally { server.close(); }
});
