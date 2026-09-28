'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/server');
const { tmpDir, BASELINE_INPUTS } = require('./helpers');

test('HTTP API enforces the human review gate and serves the UI with the exact title', async () => {
  const { app } = createApp({ dataDir: tmpDir('api'), env: {} });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (p, body) => fetch(`${base}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const home = await (await fetch(`${base}/`)).text();
    assert.match(home, /<title>Agentic QE Platform - MVP<\/title>/);
    const meta = await (await fetch(`${base}/api/meta`)).json();
    assert.equal(meta.title, 'Agentic QE Platform - MVP');
    assert.equal(meta.jira.mode, 'fixture');
    assert.equal(meta.model.mode, 'demo');
    const noBase = await post('/api/cycles', { type: 'incremental', baselineId: 'BL-404', inputs: {} });
    assert.equal(noBase.status, 400);
    const res = await post('/api/cycles', { type: 'baseline', inputs: BASELINE_INPUTS });
    assert.equal(res.status, 201);
    const cycle = await res.json();
    assert.equal(cycle.status, 'awaiting-review');
    assert.equal(cycle.artifacts.requirements, undefined, 'nothing designed before review');
    const unresolved = await post(`/api/cycles/${cycle.id}/review`, { reviewer: 'Priya' });
    assert.equal(unresolved.status, 400);
    assert.match((await unresolved.json()).error, /Unresolved conflicts/);
    const noName = await post(`/api/cycles/${cycle.id}/review`, { excluded: ['G4'] });
    assert.equal(noName.status, 400);
    const r404 = await fetch(`${base}/api/cycles/${cycle.id}/report`);
    assert.equal(r404.status, 409);
  } finally { server.close(); }
});
