'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createApp } = require('../src/server');
const { FLOWS, writeDemoInputs } = require('../scripts/make-demo-inputs');
const { tmpDir, BASELINE_INPUTS, baselineCycle } = require('./helpers');

const DIR = path.join(__dirname, '..', 'demo-inputs');
const bucketCounts = (c) => c.normalisation.groups.reduce((m, g) => ({ ...m, [g.bucket]: (m[g.bucket] || 0) + 1 }), {});

test('the downloadable Flow 1 / Flow 2 inputs in demo-inputs/ match the fixtures they were written from', () => {
  const out = tmpDir('demo-inputs');
  writeDemoInputs(out);
  for (const flow of FLOWS) {
    for (const [name] of flow.files) {
      assert.equal(fs.readFileSync(path.join(DIR, flow.dir, name), 'utf8'), fs.readFileSync(path.join(out, flow.dir, name), 'utf8'), `${flow.dir}/${name} is stale: run npm run demo:inputs`);
    }
  }
});

test('the commission baseline run from the downloaded files reads the same statements and conflict as the GitHub pull', async () => {
  const { pipeline } = createApp({ dataDir: tmpDir('paste'), env: {} });
  const file = (slot) => {
    const flow = FLOWS.find((f) => f.dir === 'flow-1-baseline');
    const [name] = flow.files.find((f) => f[1] === slot);
    return { mode: 'paste', text: fs.readFileSync(path.join(DIR, flow.dir, name), 'utf8') };
  };
  const pasted = await pipeline.startCycle({ type: 'baseline', inputs: { initiative: file('initiative'), epic: file('epic'), codebase: file('codebase') } });
  const pulled = await pipeline.startCycle({ type: 'baseline', inputs: BASELINE_INPUTS });
  assert.deepEqual(bucketCounts(pasted), bucketCounts(pulled));
  assert.ok(pasted.inputs.every((i) => i.provenance.kind === 'pasted'));
  const conflict = pasted.normalisation.groups.find((g) => g.bucket === 'conflict');
  assert.deepEqual(conflict.options.map((o) => o.signature).sort(), pulled.normalisation.groups.find((g) => g.bucket === 'conflict').options.map((o) => o.signature).sort());
});

test('reset clears every cycle and baseline, restarts ids, and serves the demo input downloads', async () => {
  const ctx = createApp({ dataDir: tmpDir('reset'), env: {} });
  await baselineCycle(ctx.pipeline, ctx.store);
  const server = ctx.app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const list = await (await fetch(`${base}/api/demo-inputs`)).json();
    assert.deepEqual(list.map((f) => [f.flow, f.branch]), [['flow-1-hotel-booking', 'demo/hotel-booking-platform'], ['flow-1-baseline', 'demo/commission-engine'], ['flow-2-incremental', 'demo/commission-engine-v2']]);
    const dl = await fetch(`${base}${list[1].files[0].url}`);
    assert.equal(dl.status, 200);
    assert.match(dl.headers.get('content-disposition'), /attachment/);
    assert.equal((await dl.json()).key, 'COM-1');
    ctx.pipeline.running.set('CYC-X', Promise.resolve());
    assert.equal((await fetch(`${base}/api/reset`, { method: 'POST' })).status, 409);
    ctx.pipeline.running.delete('CYC-X');
    assert.equal((await fetch(`${base}/api/reset`, { method: 'POST' })).status, 200);
    assert.deepEqual(await (await fetch(`${base}/api/cycles`)).json(), []);
    assert.deepEqual(await (await fetch(`${base}/api/baselines`)).json(), []);
    const again = await ctx.pipeline.startCycle({ type: 'baseline', inputs: BASELINE_INPUTS });
    assert.equal(again.id, 'CYC-1');
  } finally { server.close(); }
});
