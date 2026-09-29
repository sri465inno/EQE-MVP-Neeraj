'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/server');
const { tmpDir, BASELINE_INPUTS } = require('./helpers');

async function withServer(fn) {
  const ctx = createApp({ dataDir: tmpDir('lab'), env: {} });
  const server = ctx.app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (p, body) => { const r = await fetch(`${base}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
  try { await fn({ ...ctx, base, post }); } finally { server.close(); }
}

test('Test Lab: generated data is the full reservation, expected value comes from the rules', async () => {
  await withServer(async ({ base, post }) => {
    const lab = await (await fetch(`${base}/api/lab`)).json();
    assert.deepEqual(lab.demos.map((d) => d.id), ['happy', 'defect']);
    const defect = lab.demos.find((d) => d.id === 'defect').testCase;
    const { status, body } = await post('/api/lab/data', { ...defect, expected: '' });
    assert.equal(status, 200);
    assert.equal(body.attributeCount, 1000);
    assert.equal(body.drivers.find((d) => d.name === 'stay.nights').value, 7);
    assert.equal(body.byRules.commission, 92);
    assert.equal(body.testCase.expected, 92);
    const bad = await post('/api/lab/data', { ...defect, title: '', given: { ...defect.given, nights: 0 } });
    assert.equal(bad.status, 400);
    assert.deepEqual(bad.body.details.map((d) => d.field).sort(), ['nights', 'title']);
  });
});

test('Test Lab: happy path passes and defect path fails with expected vs actual, both really executed', async () => {
  await withServer(async ({ base, post }) => {
    const { demos } = await (await fetch(`${base}/api/lab`)).json();
    const happy = await post('/api/lab/run', demos[0].testCase);
    assert.equal(happy.status, 200);
    assert.equal(happy.body.status, 'passed');
    assert.equal(happy.body.actual, 92);
    assert.equal(happy.body.defect, null);
    assert.match(happy.body.execution.tool, /^Playwright/);
    const defect = await post('/api/lab/run', demos[1].testCase);
    assert.equal(defect.body.status, 'failed');
    assert.equal(defect.body.expected, 92);
    assert.equal(defect.body.actual, 80);
    assert.match(defect.body.defect.cause, /Long-stay bonus/);
    assert.match(defect.body.script.code, /expect\(r\.body\.commission\)\.toBe\(92\)/);
  });
});

test('approvals say what is missing: reviewer, each open conflict, and review before merge', async () => {
  await withServer(async ({ post }) => {
    const c = (await post('/api/cycles', { type: 'baseline', inputs: BASELINE_INPUTS })).body;
    const r = await post(`/api/cycles/${c.id}/review`, {});
    assert.equal(r.status, 400);
    assert.match(r.body.error, /Unresolved conflicts/);
    assert.ok(r.body.details.some((d) => d.field === 'reviewer'));
    const conflict = c.normalisation.groups.find((g) => g.bucket === 'conflict');
    assert.ok(r.body.details.some((d) => d.group === conflict.id && d.message.includes('jira says 2 %') && d.message.includes('code says 1.5 %')));
    const m = await post(`/api/cycles/${c.id}/merge`, { decision: 'approve', approver: 'Sam' });
    assert.equal(m.status, 409);
    assert.match(m.body.error, /Approve the requirement set first/);
    assert.deepEqual(m.body.details, [{ gate: 'review' }]);
  });
});
