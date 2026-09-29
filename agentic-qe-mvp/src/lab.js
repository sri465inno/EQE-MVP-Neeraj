'use strict';
// Test Lab: a person writes one test case, the platform generates the full reservation test data,
// writes a Playwright spec, really runs it against the chosen engine build and reports expected vs actual.
const fs = require('fs');
const path = require('path');
const { SPEC_PRELUDE, round } = require('./agents/catalogue');
const { executeSuite } = require('./execution');
const { BUILDS, ENGINE_DIR } = require('../sut/server');

const DICTIONARY = require(path.join(ENGINE_DIR, 'baseline', 'data-dictionary', 'reservation-attributes.json'));
const ATTR = new Map(DICTIONARY.attributes.map((a) => [a.name, a]));

// Form field -> reservation attribute it drives.
const FIELDS = {
  status: 'reservation.status',
  channel: 'channel.bookingChannel',
  nights: 'stay.nights',
  ratePlan: 'rate.planCategory',
  rooms: 'room.roomCount',
  loyalty: 'payment.loyaltyPointsRedemption',
  totalAmount: 'revenue.totalAmount',
  taxAmount: 'revenue.taxAmount',
  resortFeeAmount: 'revenue.resortFeeAmount',
  ancillaryAmount: 'revenue.ancillaryAmount',
};

// Business rules the expected value is derived from (Jira COM-10 / COM-20, GDS uplift as settled in review).
const RULES = {
  'demo/commission-engine': { release: '1.0', base: 10, gds: 1.5, longStayNights: 7, longStay: 1.5, cap: 500 },
  'demo/commission-engine-v2': { release: '2.0', base: 10, gds: 1.5, longStayNights: 7, longStay: 1.5, cap: 750, groupRooms: 10, group: 8, corporate: 5, packagePct: 70 },
};

const STD_GIVEN = { status: 'CONFIRMED', channel: 'DIRECT', nights: 3, ratePlan: 'BAR', rooms: 1, loyalty: false, totalAmount: 1000, taxAmount: 120, resortFeeAmount: 30, ancillaryAmount: 50 };

const DEMOS = [
  {
    id: 'happy',
    name: 'Happy path',
    summary: 'A 10-night direct stay earns the 1.5% long-stay bonus. The engine pays what the rule says, so the test passes.',
    testCase: {
      title: 'A 10-night direct stay earns base 10% plus the 1.5% long-stay bonus',
      build: 'demo/commission-engine',
      given: { ...STD_GIVEN, nights: 10 },
      expected: 92,
    },
  },
  {
    id: 'defect',
    name: 'Defect path',
    summary: 'A stay of exactly 7 nights should also earn the bonus ("7 nights or more"). Release 1.0 checks "more than 7", so the test fails and a defect is raised.',
    testCase: {
      title: 'A stay of exactly 7 nights earns the 1.5% long-stay bonus',
      build: 'demo/commission-engine',
      given: { ...STD_GIVEN, nights: 7 },
      expected: 92,
    },
  },
];

const httpError = (status, message, details) => Object.assign(new Error(message), { status, details });

/** Checks a test case and returns it normalised; throws 400 with a per-field list of problems. */
function normaliseCase(tc = {}) {
  const problems = [];
  const given = { ...STD_GIVEN, ...(tc.given || {}) };
  const title = String(tc.title || '').trim();
  if (!title) problems.push({ field: 'title', message: 'Give the test case a title' });
  const build = tc.build || 'demo/commission-engine';
  if (!BUILDS[build]) problems.push({ field: 'build', message: `Unknown engine build "${build}"` });
  for (const f of ['status', 'channel', 'ratePlan']) {
    const allowed = ATTR.get(FIELDS[f]).values;
    if (!allowed.includes(given[f])) problems.push({ field: f, message: `${FIELDS[f]} must be one of ${allowed.join(', ')}` });
  }
  for (const f of ['nights', 'rooms']) {
    given[f] = Number(given[f]);
    if (!Number.isInteger(given[f]) || given[f] < 1) problems.push({ field: f, message: `${FIELDS[f]} must be a whole number of 1 or more` });
  }
  for (const f of ['totalAmount', 'taxAmount', 'resortFeeAmount', 'ancillaryAmount']) {
    given[f] = Number(given[f]);
    if (!Number.isFinite(given[f]) || given[f] < 0) problems.push({ field: f, message: `${FIELDS[f]} must be an amount of 0 or more` });
  }
  if (given.totalAmount < given.taxAmount + given.resortFeeAmount + given.ancillaryAmount) {
    problems.push({ field: 'totalAmount', message: 'The total amount must include tax, resort fee and ancillaries' });
  }
  given.loyalty = given.loyalty === true || given.loyalty === 'true';
  const expected = tc.expected === '' || tc.expected == null ? null : Number(tc.expected);
  if (expected !== null && !Number.isFinite(expected)) problems.push({ field: 'expected', message: 'Expected commission must be a number' });
  if (problems.length) throw httpError(400, problems.map((p) => p.message).join('; '), problems);
  return { title, build, given, expected };
}

const overridesOf = (given) => Object.fromEntries(Object.entries(FIELDS).map(([f, attr]) => [attr, given[f]]));

/** Expected result per the business rules, independent of the engine's code. */
function expectedByRules(tc) {
  const r = RULES[tc.build];
  const g = tc.given;
  const revenue = round(g.totalAmount - g.taxAmount - g.resortFeeAmount - g.ancillaryAmount);
  const applied = [];
  if (['CANCELLED', 'NO_SHOW'].includes(g.status)) return { revenue, basis: revenue, lines: [], commission: 0, applied: [`Status ${g.status} is not commissionable`] };
  if (g.loyalty) return { revenue, basis: revenue, lines: [], commission: 0, applied: ['Paid with loyalty points: not commissionable'] };
  const basis = r.packagePct && g.ratePlan === 'PKG' ? round((revenue * r.packagePct) / 100) : revenue;
  if (basis !== revenue) applied.push(`Package rate: commission on the ${r.packagePct}% room component (USD ${basis.toFixed(2)})`);
  let lines;
  if (r.corporate && g.ratePlan === 'CORP') lines = [{ code: 'CORPORATE', label: 'Negotiated corporate rate', ratePct: r.corporate }];
  else if (r.groupRooms && g.rooms >= r.groupRooms) lines = [{ code: 'GROUP', label: 'Group flat rate', ratePct: r.group }];
  else {
    lines = [{ code: 'BASE', label: 'Base commission', ratePct: r.base }];
    if (g.channel === 'GDS') lines.push({ code: 'GDS_UPLIFT', label: 'GDS channel uplift', ratePct: r.gds });
    if (g.nights >= r.longStayNights) lines.push({ code: 'LONG_STAY', label: 'Long-stay bonus', ratePct: r.longStay });
  }
  applied.push(...lines.map((l) => `${l.label}: ${l.ratePct}%`));
  const rate = lines.reduce((s, l) => s + l.ratePct, 0);
  const gross = (basis * rate) / 100;
  if (gross > r.cap) applied.push(`Cap: USD ${r.cap}`);
  return { revenue, basis, lines, ratePct: round(rate, 4), commission: round(Math.min(gross, r.cap)), applied };
}

/** Test-data agent: the full 1000-attribute reservation, with the case's commission drivers applied. */
function generateData(input) {
  const tc = normaliseCase(input);
  const reservation = {};
  for (const a of DICTIONARY.attributes) reservation[a.name] = a.example;
  const overrides = overridesOf(tc.given);
  Object.assign(reservation, overrides);
  const oracle = expectedByRules(tc);
  return {
    testCase: { ...tc, expected: tc.expected ?? oracle.commission },
    attributeCount: Object.keys(reservation).length,
    drivers: Object.entries(overrides).map(([name, value]) => ({ name, value, example: ATTR.get(name).example, description: ATTR.get(name).description })),
    sample: DICTIONARY.attributes.filter((a) => !a.commissionDriver).slice(0, 8).map((a) => ({ name: a.name, value: a.example })),
    byRules: { release: RULES[tc.build].release, ...oracle },
  };
}

const specName = (title) => `lab-${String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)}.spec.js`;

/** Automation agent: the Playwright spec for the case. */
function renderLabSpec(tc, expected) {
  return `// Test Lab case: ${tc.title}
// Engine build: ${tc.build}; expected commission USD ${expected.toFixed(2)}
const { test, expect } = require('@playwright/test');

${SPEC_PRELUDE}

test(${JSON.stringify(`LAB-T1 ${tc.title}`)}, async ({ request }, testInfo) => {
  const r = await quote(request, testInfo, ${JSON.stringify(overridesOf(tc.given))});
  expect(r.status).toBe(200);
  expect(r.body.commission).toBe(${expected});
});
`;
}

/** Execution + defect agents: runs the spec for real and compares expected with actual. */
async function runLabCase(input, runDir) {
  const data = generateData(input);
  const tc = data.testCase;
  const expected = tc.expected;
  const file = specName(tc.title);
  const code = renderLabSpec(tc, expected);
  const exec = await executeSuite({
    scripts: [{ file, code }],
    testCases: [{ key: 'LAB-T1', name: tc.title, type: 'Functional', automation: 'Automated', scriptFile: file }],
    runDir,
    sutBuild: tc.build,
  });
  const r = exec.results[0];
  const ev = (r.evidence || []).find((e) => e.contentType === 'application/json');
  const response = ev ? JSON.parse(fs.readFileSync(path.join(runDir, 'evidence', ev.file), 'utf8')).response : null;
  const body = response && response.body;
  const actual = body && typeof body.commission === 'number' ? body.commission : null;
  const passed = r.status === 'passed';
  const result = {
    status: passed ? 'passed' : 'failed',
    testCase: tc,
    data,
    script: { file, code },
    expected,
    actual,
    actualLines: body && body.lines ? body.lines : [],
    expectedLines: data.byRules.lines.map((l) => ({ ...l, amount: round((data.byRules.basis * l.ratePct) / 100) })),
    error: r.error,
    durationMs: r.duration,
    execution: { tool: exec.tool, command: exec.command, sut: exec.sut, startedAt: exec.startedAt, finishedAt: exec.finishedAt },
    defect: null,
  };
  if (!passed) {
    const got = new Set(result.actualLines.map((l) => l.code));
    const want = new Set(result.expectedLines.map((l) => l.code));
    const missing = result.expectedLines.filter((l) => !got.has(l.code)).map((l) => l.label);
    const extra = result.actualLines.filter((l) => !want.has(l.code)).map((l) => l.label);
    result.defect = {
      title: `${tc.title}: engine pays USD ${actual == null ? '?' : actual.toFixed(2)}, expected USD ${expected.toFixed(2)}`,
      severity: 'Critical',
      build: tc.build,
      expected: `USD ${expected.toFixed(2)}`,
      actual: actual == null ? (r.error && r.error.actual) || 'no commission returned' : `USD ${actual.toFixed(2)}`,
      cause: missing.length ? `Missing from the engine's breakdown: ${missing.join(', ')}` : extra.length ? `Not expected by the rules: ${extra.join(', ')}` : 'Same rate lines, different amount (check basis, cap or rounding)',
      steps: [
        'Build the full reservation from the data dictionary',
        `Set ${data.drivers.map((d) => `${d.name}=${d.value}`).join(', ')}`,
        'POST /api/commission/quote',
        `Compare commission with USD ${expected.toFixed(2)}`,
      ],
    };
  }
  fs.writeFileSync(path.join(runDir, 'lab-result.json'), JSON.stringify(result, null, 2));
  return result;
}

module.exports = { DEMOS, FIELDS, normaliseCase, generateData, expectedByRules, renderLabSpec, runLabCase };
