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

test('Test Lab: a plain-English test becomes the full reservation, expected value comes from the rules', async () => {
  await withServer(async ({ base, post }) => {
    const lab = await (await fetch(`${base}/api/lab`)).json();
    assert.deepEqual(lab.demos.map((d) => d.id), ['happy', 'defect']);
    const defect = lab.demos.find((d) => d.id === 'defect');
    const { status, body } = await post('/api/lab/data', { text: defect.text });
    assert.equal(status, 200);
    assert.equal(body.attributeCount, 1000);
    assert.equal(body.drivers.find((d) => d.name === 'stay.nights').value, 7);
    assert.equal(body.drivers.find((d) => d.name === 'channel.bookingChannel').value, 'DIRECT');
    assert.equal(body.byRules.commission, 92);
    assert.equal(body.testCase.expected, 92);
    assert.equal(body.reading.find((x) => x.field === 'nights').from, 'your test');
    assert.equal(body.reading.find((x) => x.field === 'totalAmount').from, 'standard booking');
    for (const text of lab.examples) assert.equal((await post('/api/lab/data', { text })).status, 200, text);
    const words = (await post('/api/lab/data', { text: 'A thirteen-night direct booking.' })).body;
    assert.equal(words.testCase.given.nights, 13);
    assert.equal((await post('/api/lab/data', { text: 'A booking that is not paid with loyalty points.' })).body.testCase.given.loyalty, false);
    const corp = (await post('/api/lab/data', { text: 'A 2-night corporate booking should earn 5%.' })).body;
    assert.equal(corp.testCase.build, 'demo/commission-engine-v2');
    assert.equal(corp.byRules.commission, 40);
  });
});

test('Test Lab: sentences that cannot become a test get plain-language reasons', async () => {
  await withServer(async ({ post }) => {
    const says = async (text, re) => {
      const r = await post('/api/lab/data', { text });
      assert.equal(r.status, 400, text);
      assert.ok(r.body.details.some((d) => re.test(d.message)), `${text}: ${JSON.stringify(r.body)}`);
      return r.body;
    };
    await says('', /Describe the booking/);
    await says('hello world', /Describe the booking the test is about/);
    await says('A 7-night direct booking for 2 adults should earn USD 92.', /can't tell what "2 adults" means/);
    await says('A direct GDS booking of 5 nights.', /more than one booking channel/);
    await says('A 10-night stay should earn the 2% long-stay bonus.', /long-stay bonus is 2%, but the specs set it at 1.5%/);
    const b = await says('A 7-night direct booking should earn USD 80 commission.', /expects USD 80.00, but by the release 1.0 rules this booking earns USD 92.00/);
    assert.equal(b.error, 'Your expected result does not match the specs');
    await says('A direct booking of 0 nights.', /at least 1 night/);
    await says('A booking that is not cancelled.', /status is not \("not cancelled"\)/);
    await says('A direct booking of -7 nights.', /cannot be negative/);
    await says('A direct booking for a few nights.', /can't tell how many/);
    await says('A booking with a total of USD 100 including USD 200 tax.', /less than the tax, resort fee and extras/);
  });
});

test('Test Lab: happy path passes and defect path fails with expected vs actual, both really executed', async () => {
  await withServer(async ({ base, post }) => {
    const { demos } = await (await fetch(`${base}/api/lab`)).json();
    const happy = await post('/api/lab/run', { text: demos[0].text });
    assert.equal(happy.status, 200);
    assert.equal(happy.body.status, 'passed');
    assert.equal(happy.body.actual, 92);
    assert.equal(happy.body.defect, null);
    assert.match(happy.body.execution.tool, /^Playwright/);
    const defect = await post('/api/lab/run', { text: demos[1].text });
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
