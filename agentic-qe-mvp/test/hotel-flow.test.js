'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createApp } = require('../src/server');
const { loadCodebaseFixture } = require('../src/connectors/codebase');
const { issueRole, statementsFromIssue, statementsFromCodebase } = require('../src/extract');
const { FLOWS } = require('../scripts/make-demo-inputs');
const { domainOf } = require('../src/agents/domains');
const { getTestingType } = require('../src/testing-types');
const { tmpDir } = require('./helpers');

const HOTEL = 'demo/hotel-booking-platform';
const EPICS = 'AQPI-2, AQPI-6, AQPI-10, AQPI-14, AQPI-18, AQPI-23, AQPI-27';
const HOTEL_INPUTS = { initiative: { mode: 'jira', key: 'AQPI-1' }, epic: { mode: 'jira', key: EPICS }, codebase: { mode: 'sample', branch: HOTEL } };
const jira = (key) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'jira', `${key}.json`), 'utf8'));

test('AQPI issues keep their initiative, epic and story roles, and stories yield their acceptance criteria', () => {
  assert.equal(issueRole(jira('AQPI-1')), 'initiative');
  for (const k of EPICS.split(', ')) assert.equal(issueRole(jira(k)), 'epic', k);
  assert.equal(issueRole(jira('AQPI-21')), 'story');
  const st = statementsFromIssue(jira('AQPI-21'), { baseUrl: 'https://jira.example', input: 'epic' });
  assert.ok(st.length >= 4);
  assert.ok(st.every((s) => s.origin.kind === 'jira-story' && s.origin.ref === 'AQPI-21'));
  assert.ok(st.some((s) => /idempotency key/i.test(s.text)));
});

test('the hotel codebase fixture carries its Maven build, booking data dictionary and @rule statements', () => {
  const cb = loadCodebaseFixture(HOTEL);
  assert.equal(cb.build.tool, 'maven');
  assert.equal(cb.build.java, '21');
  assert.ok(cb.files.some((f) => f.path === 'TRACEABILITY.md'));
  assert.match(cb.dataModel.file, /booking-attributes\.json$/);
  assert.ok(statementsFromCodebase(cb).length >= 5);
});

test('Flow 1 loads AQPI-1, all seven epics with their 23 stories and the hotel codebase as one hotel cycle', async () => {
  const { pipeline } = createApp({ dataDir: tmpDir('hotel'), env: {} });
  const c = await pipeline.startCycle({ type: 'baseline', inputs: HOTEL_INPUTS });
  assert.equal(c.sutBuild, HOTEL);
  assert.equal(domainOf(c).id, 'hotel');
  const epic = c.inputs.find((i) => i.slot === 'epic');
  assert.equal(epic.ref, EPICS);
  assert.equal(epic.children.length, 23);
  assert.match(pipeline.dictionaryOf(c).source, /booking-attributes\.json$/);
});

test('the downloaded hotel files paste into the same Jira statements and the same hotel build as the pull', async () => {
  const { pipeline } = createApp({ dataDir: tmpDir('hotel-paste'), env: {} });
  const flow = FLOWS.find((f) => f.dir === 'flow-1-hotel-booking');
  const file = (slot) => ({ mode: 'paste', text: fs.readFileSync(path.join(__dirname, '..', 'demo-inputs', flow.dir, flow.files.find((f) => f[1] === slot)[0]), 'utf8') });
  const pasted = await pipeline.startCycle({ type: 'baseline', inputs: { initiative: file('initiative'), epic: file('epic'), codebase: { ...file('codebase'), branch: HOTEL } } });
  const pulled = await pipeline.startCycle({ type: 'baseline', inputs: HOTEL_INPUTS });
  assert.equal(pasted.sutBuild, HOTEL);
  const jiraCount = (c) => c.inputs.filter((i) => i.slot !== 'codebase').map((i) => i.statementCount);
  assert.deepEqual(jiraCount(pasted), jiraCount(pulled));
  assert.match(pipeline.dictionaryOf(pasted).source, /build demo\/hotel-booking-platform/);
});

test('without the built hotel jars the execution phase fails with the reason; nothing is reported as passed', async () => {
  const prev = process.env.HOTEL_PLATFORM_DIR;
  process.env.HOTEL_PLATFORM_DIR = tmpDir('no-jars');
  try {
    const { pipeline, store } = createApp({ dataDir: tmpDir('hotel-nojar'), env: {} });
    const c = await pipeline.startCycle({ type: 'baseline', inputs: HOTEL_INPUTS, testingType: 'smoke' });
    await pipeline.review(c.id, { reviewer: 'Priya Shah' }).done;
    const done = store.getCycle(c.id);
    assert.equal(done.status, 'failed');
    const exec = done.phases.find((p) => p.name === 'execution');
    assert.equal(exec.status, 'failed');
    assert.match(exec.error || exec.message || JSON.stringify(exec), /not built/);
    assert.ok(!done.artifacts.execution?.summary?.passed);
  } finally {
    if (prev === undefined) delete process.env.HOTEL_PLATFORM_DIR; else process.env.HOTEL_PLATFORM_DIR = prev;
  }
});

test('meta lists the hotel booking example as Flow 1 and keeps the commission samples for Flow 2', async () => {
  const ctx = createApp({ dataDir: tmpDir('meta'), env: {} });
  const server = ctx.app.listen(0);
  try {
    const meta = await (await fetch(`http://127.0.0.1:${server.address().port}/api/meta`)).json();
    const [hotel, commission] = meta.platform.examples;
    assert.deepEqual([hotel.id, hotel.flow, hotel.modes], ['hotel', 1, ['baseline']]);
    assert.deepEqual(hotel.samples, { initiative: 'AQPI-1', epic: EPICS, baselineBranch: HOTEL });
    assert.deepEqual(hotel.testingTypes, ['functional', 'regression', 'e2e']);
    assert.deepEqual([commission.id, commission.flow, commission.modes], ['commission', 2, ['baseline', 'incremental']]);
    assert.deepEqual(commission.samples, meta.samples);
    assert.equal(meta.samples.incrementalBranch, 'demo/commission-engine-v2');
  } finally { server.close(); }
});

test('hotel cycles describe the hotel journeys and capability, commission cycles keep their wording', () => {
  const e2e = getTestingType('e2e', domainOf(HOTEL).id);
  assert.match(e2e.focus, /search.*confirmation e-mail/);
  assert.doesNotMatch(`${e2e.focus} ${e2e.baseline} ${Object.values(e2e.agents).join(' ')}`, /advisor|statement|screenshot of each/);
  assert.match(getTestingType('e2e').agents.scripts, /statement page/);
  assert.match(domainOf(HOTEL).capability, /hotel booking/i);
  assert.match(domainOf('demo/commission-engine').capability, /commission/);
});
