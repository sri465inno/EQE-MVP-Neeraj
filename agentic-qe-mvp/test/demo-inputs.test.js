'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createApp } = require('../src/server');
const { FLOWS, writeDemoInputs } = require('../scripts/make-demo-inputs');
const { tmpDir, BASELINE_INPUTS, baselineCycle } = require('./helpers');

const DIR = path.join(__dirname, '..', 'demo-inputs');

test('the downloadable Flow 1 / Flow 2 inputs in demo-inputs/ match the fixtures they were written from', () => {
  const out = tmpDir('demo-inputs');
  writeDemoInputs(out);
  for (const flow of FLOWS) {
    for (const [name] of flow.files) {
      assert.equal(fs.readFileSync(path.join(DIR, flow.dir, name), 'utf8'), fs.readFileSync(path.join(out, flow.dir, name), 'utf8'), `${flow.dir}/${name} is stale: run npm run demo:inputs`);
    }
  }
});

test('reset clears every cycle and baseline, restarts ids, and serves the demo input downloads', async () => {
  const ctx = createApp({ dataDir: tmpDir('reset'), env: {} });
  await baselineCycle(ctx.pipeline, ctx.store);
  const server = ctx.app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const list = await (await fetch(`${base}/api/demo-inputs`)).json();
    assert.deepEqual(list.map((f) => [f.flow, f.branch]), [['flow-1-hotel-booking', 'demo/hotel-booking-platform'], ['flow-2-hotel-release-2', 'demo/hotel-booking-platform-v2']]);
    const dl = await fetch(`${base}${list[1].files[0].url}`);
    assert.equal(dl.status, 200);
    assert.match(dl.headers.get('content-disposition'), /attachment/);
    assert.equal((await dl.json()).issues[0].key, 'AQPI-32');
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
