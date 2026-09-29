'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { testDataAgent, dataSetFile, readCaseData } = require('../src/agents/testdata');
const { producedBy } = require('../src/handover');

const DICT = require('../samples/commission-engine/baseline/data-dictionary/reservation-attributes.json');
const attrs = new Map(DICT.attributes.map((a) => [a.name, a]));
const tc = (key, testData, expected = 'commission 80.00') => ({ key, requirementId: 'REQ-001', testData, expected });

test('test data agent: one full data set per case, drivers from the case, the rest from the dictionary examples', () => {
  const { dataSets, summary } = testDataAgent([tc('TC-F-001', 'channel.bookingChannel=GDS; stay.nights=7; every other attribute from the data dictionary examples')], DICT, { source: 'codebase input' });
  const [d] = dataSets;
  assert.equal(d.id, 'TD-F-001');
  assert.deepEqual(d.drivers.map((x) => [x.attribute, x.value]), [['channel.bookingChannel', 'GDS'], ['stay.nights', 7]]);
  assert.equal(d.conformance, 'conforms');
  assert.equal(d.attributeCount, 1000);
  assert.equal(d.generated, 998);
  assert.deepEqual(summary.dictionary, { name: DICT.name, version: DICT.version, attributeCount: 1000, source: 'codebase input' });
  const file = dataSetFile(d, DICT);
  assert.equal(Object.keys(file.reservation).length, 1000);
  assert.equal(file.reservation['stay.nights'], 7);
  for (const a of DICT.attributes.filter((x) => !['channel.bookingChannel', 'stay.nights'].includes(x.name))) assert.deepEqual(file.reservation[a.name], a.example, a.name);
});

test('test data agent: data that breaks the spec is a negative test only when the case expects a 4xx', () => {
  const channel = [...attrs.values()].find((a) => a.name === 'channel.bookingChannel');
  assert.ok(!channel.values.includes('FAX'));
  const { dataSets, summary } = testDataAgent([tc('TC-F-010', 'channel.bookingChannel=FAX', 'HTTP 422 with a validation error'), tc('TC-F-011', 'stay.nights=-3')], DICT);
  assert.equal(dataSets[0].conformance, 'negative test');
  assert.equal(dataSets[1].conformance, 'does not conform');
  assert.ok(dataSets[1].problems.length);
  assert.equal(summary.negative, 1);
  assert.equal(summary.nonConforming, 1);
  assert.equal(producedBy('testdata', { artifacts: { testData: dataSets } }).specConformance.value.length, 1);
});

test('test data agent (incremental): unchanged drivers carry over, changed drivers re-generate with a new version, new cases are new', () => {
  const first = testDataAgent([tc('TC-F-001', 'stay.nights=7'), tc('TC-F-002', 'revenue.totalAmount=8000')], DICT).dataSets;
  const next = testDataAgent([tc('TC-F-001', 'stay.nights=7'), tc('TC-F-002', 'revenue.totalAmount=9000'), tc('TC-F-003', 'stay.nights=10')], DICT, { previous: first }).dataSets;
  assert.deepEqual(next.map((d) => [d.status, d.version]), [['carried over', 1], ['re-generated', 2], ['new', 1]]);
});

test('test data agent: settings that are not dictionary attributes stay run parameters, never invented attributes', () => {
  const { drivers, parameters } = readCaseData('stay.nights=7; clients=5', attrs);
  assert.deepEqual(drivers.map((d) => d.attribute), ['stay.nights']);
  assert.deepEqual(parameters, { clients: '5' });
});
