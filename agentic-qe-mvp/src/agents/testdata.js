'use strict';
// Test data agent: one data set per test case, generated from the data dictionary in the codebase input.
// The case fixes its commission drivers; every other attribute takes its dictionary example.
// Each value is checked against the spec; a case that deliberately breaks it (an HTTP 4xx case) is a negative test.

const clone = (x) => JSON.parse(JSON.stringify(x));

function coerce(attr, raw) {
  const v = String(raw).trim();
  if (attr.type === 'integer' || attr.type === 'decimal') return v === '' ? v : Number(v);
  if (attr.type === 'boolean') return v === 'true' ? true : v === 'false' ? false : v;
  return v;
}

/** Splits a case's test data line into dictionary attributes (drivers) and run parameters. */
function readCaseData(testData, attrs) {
  const drivers = [];
  const parameters = {};
  for (const part of String(testData || '').split(';')) {
    const m = part.match(/^\s*([\w.]+(?:\s[\w.]+)*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const attr = attrs.get(m[1]);
    if (!attr) { parameters[m[1]] = m[2]; continue; }
    const values = m[2].split(/\s*\|\s*/).map((x) => coerce(attr, x));
    drivers.push({ attribute: attr.name, value: values[0], ...(values.length > 1 ? { variants: values } : {}) });
  }
  return { drivers, parameters };
}

function specOf(attr) {
  if (attr.values) return `one of ${attr.values.join(', ')}`;
  return `${attr.type}${attr.required ? ', required' : ''}`;
}

function checkValue(attr, v) {
  if (attr.required && (v === '' || v === null || v === undefined)) return `${attr.name} is required but empty`;
  if (v === '' && !attr.required) return null;
  if (attr.values && !attr.values.includes(v)) return `${attr.name} = ${v} is not an allowed value (${attr.values.join(', ')})`;
  if (attr.type === 'integer' && !(Number.isInteger(v) && v >= 0)) return `${attr.name} = ${v} is not a whole number of 0 or more`;
  if (attr.type === 'decimal' && !(Number.isFinite(v) && v >= 0)) return `${attr.name} = ${v} is not an amount of 0 or more`;
  if (attr.type === 'boolean' && typeof v !== 'boolean') return `${attr.name} = ${v} is not true or false`;
  return null;
}

const generatedValue = (attr) => attr.example;

function buildReservation(dictionary, set) {
  const fixed = new Map(set.drivers.map((d) => [d.attribute, d.value]));
  const res = {};
  for (const a of dictionary.attributes) res[a.name] = fixed.has(a.name) ? fixed.get(a.name) : generatedValue(a);
  return res;
}

function crossChecks(res) {
  const total = res['revenue.totalAmount'];
  const parts = ['revenue.taxAmount', 'revenue.resortFeeAmount', 'revenue.ancillaryAmount'].reduce((s, k) => s + (Number(res[k]) || 0), 0);
  return Number.isFinite(total) && total < parts ? [`revenue.totalAmount ${total} is less than its tax, fees and extras (${parts})`] : [];
}

const sameSet = (a, b) => JSON.stringify([a.drivers, a.parameters]) === JSON.stringify([b.drivers, b.parameters]);

/**
 * testCases: designed cases (keys, testData line, expected). dictionary: { name, version, attributes }.
 * previous: data sets of the baseline (incremental), matched by test case key.
 */
function testDataAgent(testCases, dictionary, { previous = [], source = null } = {}) {
  const attrs = new Map(dictionary.attributes.map((a) => [a.name, a]));
  const prev = new Map((previous || []).map((d) => [d.testCaseKey, d]));
  const dataSets = testCases.map((t) => {
    const { drivers, parameters } = readCaseData(t.testData, attrs);
    const base = { id: t.key.replace(/^TC-/, 'TD-'), testCaseKey: t.key, requirementId: t.requirementId, drivers, parameters };
    const res = buildReservation(dictionary, { ...base, testCaseKey: t.key });
    const problems = [
      ...drivers.flatMap((d) => (d.variants || [d.value]).map((v) => checkValue(attrs.get(d.attribute), v)).filter(Boolean)),
      ...crossChecks(res),
    ];
    const negative = problems.length > 0 && /HTTP 4\d\d/.test(String(t.expected));
    const p = prev.get(t.key);
    const set = {
      ...base,
      drivers: drivers.map((d) => ({ ...d, spec: specOf(attrs.get(d.attribute)) })),
      attributeCount: Object.keys(res).length,
      generated: Object.keys(res).length - drivers.length,
      conformance: !problems.length ? 'conforms' : negative ? 'negative test' : 'does not conform',
      problems,
      file: `test-data/${t.key}.json`,
    };
    const status = !p ? 'new' : sameSet(p, set) ? 'carried over' : 're-generated';
    return { ...set, status, version: !p ? 1 : p.version + (status === 'carried over' ? 0 : 1) };
  });
  const count = (f) => dataSets.filter(f).length;
  return {
    dataSets,
    summary: {
      dictionary: { name: dictionary.name, version: dictionary.version, attributeCount: dictionary.attributes.length, source },
      total: dataSets.length,
      conforming: count((d) => d.conformance === 'conforms'),
      negative: count((d) => d.conformance === 'negative test'),
      nonConforming: count((d) => d.conformance === 'does not conform'),
      byStatus: dataSets.reduce((m, d) => ({ ...m, [d.status]: (m[d.status] || 0) + 1 }), {}),
      method: 'Commission drivers come from the test case; every other attribute takes the value the data dictionary specifies as its example.',
    },
  };
}

/** The file a generated spec loads: the full reservation plus where each value came from. */
function dataSetFile(set, dictionary) {
  return {
    dataSet: set.id, testCase: set.testCaseKey, generatedBy: 'Test data agent',
    dictionary: { name: dictionary.name, version: dictionary.version },
    drivers: clone(set.drivers), parameters: clone(set.parameters), conformance: set.conformance, problems: clone(set.problems),
    reservation: buildReservation(dictionary, set),
  };
}

module.exports = { testDataAgent, dataSetFile, buildReservation, readCaseData };
