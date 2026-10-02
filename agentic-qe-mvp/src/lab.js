'use strict';
// Test Lab: a person writes one hotel booking test in plain English, the platform builds the full booking test data
// from the hotel data dictionary, writes a Playwright spec, really runs it against the chosen release of the six
// hotel services and reports expected vs actual.
const fs = require('fs');
const path = require('path');
const { HOTEL_PRELUDE } = require('./agents/hotel-catalogue');
const { executeSuite } = require('./execution');
const { BRANCHES } = require('./connectors/codebase');
const { HOTEL_BRANCH, HOTEL_BRANCH_V2 } = require('../sut/hotel');

const decode = (c) => JSON.parse(Buffer.from(c.content.replace(/\n/g, ''), c.encoding || 'base64').toString('utf8'));
const dictionaryOf = (branch) => decode(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'github', BRANCHES[branch].dir, 'contents', 'data-dictionary', 'booking-attributes.json.json'), 'utf8')));

// Business rules the expected result is derived from: AQPI-4, AQPI-15, AQPI-26 (release 1.0) and AQPI-33 to AQPI-36 (release 2.0).
const RULES = {
  [HOTEL_BRANCH]: { release: '1.0', maxNights: 30, parisNights: 21, cartMinutes: 30, resends: 3, cancelHours: null },
  [HOTEL_BRANCH_V2]: { release: '2.0', maxNights: 30, parisNights: 14, cartMinutes: 20, resends: 5, cancelHours: 48 },
};

const DEMOS = [
  {
    id: 'happy',
    name: 'Happy path',
    summary: 'Release 2.0 allows a Paris stay of up to 14 nights (AQPI-34). The search service accepts 14 nights, so the test passes.',
    text: 'A 14-night stay in Paris should be accepted.',
  },
  {
    id: 'defect',
    name: 'Defect path',
    summary: 'Release 2.0 limits Paris to 14 nights, but the code still accepts 15, so the test fails and a defect is raised.',
    text: 'A 15-night stay in Paris should be rejected, because Paris allows at most 14 nights.',
  },
];

const EXAMPLES = [
  'A 31-night stay in New York should be rejected.',
  'A 21-night stay in Paris on release 1.0 should be accepted.',
  'A flexible booking cancelled 10 days before check-in should be cancelled free of charge.',
  'A flexible booking cancelled 1 day before check-in should be refused.',
  'A non-refundable booking should not be cancelled free of charge.',
  'The 6th confirmation resend should be refused.',
  'A new cart should expire after 20 minutes.',
];

const CITIES = { NYC: 'New York', LON: 'London', PAR: 'Paris' };
const RATES = { FLEX: 'Flexible (pay at hotel)', SAVER: 'Saver (prepaid, non-refundable)' };
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four', 'twenty-five', 'twenty-six', 'twenty-seven', 'twenty-eight', 'twenty-nine', 'thirty', 'thirty-one'];
const ORDINALS = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

const httpError = (status, message, details) => Object.assign(new Error(message), { status, details });
const fail = (message, list) => { throw httpError(400, message, list.map((m) => ({ message: m }))); };
const listText = (xs, last = 'and') => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${last} ${xs[xs.length - 1]}`);

function wordsToNumbers(text) {
  let t = text;
  for (let n = NUMBER_WORDS.length - 1; n > 0; n -= 1) t = t.replace(new RegExp(`\\b${NUMBER_WORDS[n]}\\b`, 'g'), String(n));
  for (let n = ORDINALS.length - 1; n > 0; n -= 1) t = t.replace(new RegExp(`\\b${ORDINALS[n]}\\b`, 'g'), `${n}th`);
  return t;
}

/** accepted / refused as the test states it, or null when it does not say. */
function statedOutcome(text) {
  const m = text.match(/\b(?:should|must|will|is|are|gets?|to)\s+(not\s+|never\s+)?(?:be\s+)?(rejected|refused|blocked|denied|accepted|allowed|cancell?ed|succeed\w*|fail\w*|go through|work\w*)/);
  if (!m) return null;
  const refused = /^(rejected|refused|blocked|denied|fail)/.test(m[2]);
  return (refused !== Boolean(m[1])) ? 'refused' : 'accepted';
}

function kindOf(t) {
  if (/cancel/.test(t)) return 'cancellation';
  if (/resen[dt]/.test(t)) return 'resend';
  if (/\bcart\b/.test(t) && /expir|hold|minutes?/.test(t)) return 'cart';
  if (/\bnights?\b|\bweeks?\b|\bstay\b/.test(t)) return 'stay';
  return null;
}

/** Test design agent: turns one plain-English hotel test into a test case with its expected result from the rules. */
function readPlainEnglish(input) {
  const original = String(input || '').trim();
  if (!original) fail('Describe the booking the test is about', ['Describe the booking the test is about, for example "A 15-night stay in Paris should be rejected".']);
  const t = wordsToNumbers(original.toLowerCase());
  const kind = kindOf(t);
  if (!kind) {
    fail('The platform could not find a booking in your test', ['Describe the booking the test is about. Test Lab runs stay-length searches ("a 15-night stay in Paris"), free cancellation ("cancelled 10 days before check-in"), confirmation resends ("the 6th resend") and cart expiry ("a cart should expire after 20 minutes").']);
  }
  const problems = [];
  const notes = [];
  const rel = t.match(/\brelease\s*([12])(?:\.0)?\b|\bv([12])\b/);
  const release = rel ? Number(rel[1] || rel[2]) : null;
  const build = release === 1 ? HOTEL_BRANCH : HOTEL_BRANCH_V2;
  const r = RULES[build];
  if (/-\s*\d/.test(t.replace(/\b\d+-(?:night|day|hour|minute|week)/g, ''))) problems.push('A number in your test cannot be negative.');
  const said = {};
  const given = { 'search.destination': 'NYC', 'stay.nights': 3, 'stay.checkInOffsetDays': 30, 'selection.ratePlanCode': 'FLEX' };
  let expectation = statedOutcome(t);
  let expected;
  let ruleText;
  let attempt = null;

  if (kind === 'stay') {
    const nights = t.match(/(\d+)[\s-]*nights?\b/);
    const weeks = t.match(/(\d+)[\s-]*weeks?\b/);
    if (nights) said.nights = Number(nights[1]);
    else if (weeks) { said.nights = Number(weeks[1]) * 7; notes.push(`${weeks[1]} week(s) is read as ${said.nights} nights.`); }
    else problems.push('Your test mentions a stay but I can\'t tell how many nights. Write the number, for example "15 nights".');
    const cities = [[/\bparis\b|\bpar\b/, 'PAR'], [/\blondon\b|\blon\b/, 'LON'], [/new york|\bnyc\b/, 'NYC']].filter(([re]) => re.test(t)).map(([, c]) => c);
    if (cities.length > 1) problems.push(`Your test mentions more than one destination (${listText(cities.map((c) => CITIES[c]))}). A search has only one; keep the one you mean.`);
    else if (cities.length) said.destination = cities[0];
    else {
      const other = original.match(/\b(?:in|to)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/);
      if (other) problems.push(`The hotel catalogue only has New York, London and Paris, so "${other[1]}" can't be searched.`);
    }
    if (said.nights !== undefined && said.nights < 1) problems.push('A stay has to be at least 1 night.');
    if (problems.length) fail('The platform could not turn this into a test yet', problems);
    if (said.destination) given['search.destination'] = said.destination;
    if (said.nights !== undefined) given['stay.nights'] = said.nights;
    const dest = given['search.destination'];
    const limit = dest === 'PAR' ? r.parisNights : r.maxNights;
    const outcome = given['stay.nights'] <= limit ? 'accepted' : 'refused';
    ruleText = dest === 'PAR' ? `Paris (PAR) allows at most ${limit} nights` : `a stay can be at most ${limit} nights`;
    if (expectation && expectation !== outcome) {
      fail('Your expected result does not match the specs', [`Your test says the stay is ${expectation === 'refused' ? 'rejected' : 'accepted'}, but by the release ${r.release} rules ${ruleText}, so a ${given['stay.nights']}-night stay in ${CITIES[dest]} is ${outcome === 'refused' ? 'rejected' : 'accepted'}.`, 'Correct the expectation, or leave it out and the platform will work it out from the rules.']);
    }
    expectation = outcome;
    expected = outcome === 'refused'
      ? { status: 400, code: 'VALIDATION_FAILED', summary: 'HTTP 400 VALIDATION_FAILED (stay.tooLong)' }
      : { status: 200, code: null, summary: 'HTTP 200 with search results' };
  } else if (kind === 'cancellation') {
    if (r.cancelHours == null) fail('The platform could not turn this into a test yet', ['Release 1.0 has no cancellation rule: free cancellation is new in release 2.0 (AQPI-36). Say "release 2.0" or leave the release out.']);
    if (/non[\s-]?refundable|\bsaver\b|prepaid/.test(t)) said.rate = 'SAVER';
    else if (/flex|refundable/.test(t)) said.rate = 'FLEX';
    const lead = t.match(/(\d+)\s*(days?|hours?)\s*(?:before|ahead|prior|until)/);
    if (lead) {
      const n = Number(lead[1]);
      if (/hour/.test(lead[2]) && n % 24) problems.push(`Check-in is at midnight UTC, so write the notice in whole days or multiples of 24 hours ("${n} hours" isn't).`);
      else said.days = /hour/.test(lead[2]) ? n / 24 : n;
    } else if (/day before check-?in|tomorrow/.test(t)) said.days = 1;
    if (said.days !== undefined && said.days < 1) problems.push('Check-in has to be at least 1 day ahead for the booking to be made.');
    if (said.days !== undefined && said.days > 500) problems.push('Check-in can be at most 500 days ahead.');
    if (problems.length) fail('The platform could not turn this into a test yet', problems);
    if (said.rate) given['selection.ratePlanCode'] = said.rate;
    if (said.days !== undefined) given['stay.checkInOffsetDays'] = said.days;
    const days = given['stay.checkInOffsetDays'];
    const open = days > r.cancelHours / 24;
    if (days === r.cancelHours / 24) notes.push(`Check-in is at midnight UTC, so ${days} days ahead is less than ${r.cancelHours} hours away for most of today: the window is already closed.`);
    const outcome = given['selection.ratePlanCode'] === 'FLEX' && open ? 'accepted' : 'refused';
    ruleText = given['selection.ratePlanCode'] === 'SAVER' ? 'a non-refundable rate cannot be cancelled free of charge'
      : `a confirmed booking can be cancelled free of charge up to ${r.cancelHours} hours before check-in`;
    if (expectation && expectation !== outcome) {
      fail('Your expected result does not match the specs', [`Your test says the cancellation is ${expectation}, but by the release ${r.release} rules ${ruleText}, so this one is ${outcome}.`, 'Correct the expectation, or leave it out and the platform will work it out from the rules.']);
    }
    expectation = outcome;
    const code = given['selection.ratePlanCode'] === 'SAVER' ? 'NON_REFUNDABLE_RATE' : 'FREE_CANCELLATION_CLOSED';
    expected = outcome === 'accepted'
      ? { status: 200, code: null, reservationStatus: 'CANCELLED', summary: 'HTTP 200, reservation CANCELLED' }
      : { status: 409, code, reservationStatus: 'CONFIRMED', summary: `HTTP 409 ${code}, reservation stays CONFIRMED` };
  } else if (kind === 'resend') {
    const nth = t.match(/(\d+)(?:st|nd|rd|th)\s+(?:confirmation\s+)?(?:e-?mail\s+)?resend/) || t.match(/resen[dt]\s+(?:it\s+)?(\d+)\s+times?/) || t.match(/(\d+)\s+(?:confirmation\s+)?resends/);
    if (!nth) problems.push('Your test mentions a resend but I can\'t tell which one. Write it as "the 6th resend" or "resent 5 times".');
    else attempt = Number(nth[1]);
    if (attempt !== null && (attempt < 1 || attempt > 20)) problems.push('Pick a resend between the 1st and the 20th.');
    if (problems.length) fail('The platform could not turn this into a test yet', problems);
    const outcome = attempt <= r.resends ? 'accepted' : 'refused';
    ruleText = `a confirmation can be resent at most ${r.resends} times per booking in 24 hours`;
    if (expectation && expectation !== outcome) {
      fail('Your expected result does not match the specs', [`Your test says resend ${attempt} is ${expectation}, but by the release ${r.release} rules ${ruleText}, so it is ${outcome}.`, 'Correct the expectation, or leave it out and the platform will work it out from the rules.']);
    }
    expectation = outcome;
    expected = outcome === 'accepted' ? { status: 202, code: null, summary: `Resend ${attempt} returns HTTP 202` } : { status: 429, code: 'RESEND_RATE_LIMITED', summary: `Resend ${attempt} returns HTTP 429 RESEND_RATE_LIMITED` };
  } else {
    const min = t.match(/(\d+)\s*min/);
    ruleText = `a cart expires ${r.cartMinutes} minutes after it is created`;
    if (min && Number(min[1]) !== r.cartMinutes) {
      fail('Your expected result does not match the specs', [`Your test expects the cart to expire after ${min[1]} minutes, but by the release ${r.release} rules ${ruleText}.`, 'Correct the number, or leave it out and the platform will work it out from the rules.']);
    }
    expectation = 'accepted';
    expected = { status: 201, minutes: r.cartMinutes, summary: `Cart created (HTTP 201), expires after ${r.cartMinutes} minutes` };
  }

  const tc = { title: original, text: original, build, kind, given, attempt, expectation, expected };
  const from = (k) => (said[k] !== undefined ? 'your test' : 'standard booking');
  const reading = [];
  if (kind === 'stay') reading.push({ field: 'destination', label: 'Destination', value: CITIES[given['search.destination']], from: from('destination') }, { field: 'nights', label: 'Nights', value: String(given['stay.nights']), from: from('nights') });
  if (kind === 'cancellation') reading.push({ field: 'rate', label: 'Rate plan', value: RATES[given['selection.ratePlanCode']], from: from('rate') }, { field: 'days', label: 'Check-in', value: `${given['stay.checkInOffsetDays']} day(s) from today`, from: from('days') });
  if (kind === 'resend') reading.push({ field: 'attempt', label: 'Resend', value: `number ${attempt}`, from: 'your test' });
  reading.push({ field: 'build', label: 'Hotel release', value: r.release, from: release !== null ? 'your test' : 'latest (release 2.0)' });
  reading.push({ field: 'expected', label: 'Expected result', value: expected.summary, from: statedOutcome(t) ? 'your test, checked against the specs' : 'worked out from the specs' });
  return { testCase: tc, reading, notes, ruleText };
}

/** Test data agent: the full booking from the hotel data dictionary with the case's drivers applied. */
function generateData(input = {}) {
  const read = readPlainEnglish(input.text);
  const tc = read.testCase;
  const dictionary = dictionaryOf(tc.build);
  const attr = new Map(dictionary.attributes.map((a) => [a.name, a]));
  const reservation = Object.fromEntries(dictionary.attributes.map((a) => [a.name, a.example]));
  const drivers = Object.keys(tc.given).filter((k) => tc.given[k] !== attr.get(k).example || ['stay.nights', 'search.destination'].includes(k) && tc.kind === 'stay')
    .map((name) => ({ name, value: tc.given[name], example: attr.get(name).example, description: attr.get(name).description }));
  for (const d of drivers) reservation[d.name] = d.value;
  return {
    testCase: tc,
    booking: reservation,
    attributeCount: Object.keys(reservation).length,
    drivers,
    sample: dictionary.attributes.filter((a) => !drivers.some((d) => d.name === a.name)).slice(0, 8).map((a) => ({ name: a.name, value: a.example })),
    byRules: { release: RULES[tc.build].release, rule: read.ruleText, expected: tc.expected.summary },
    reading: read.reading,
    notes: read.notes,
  };
}

const RESEND = "call(request, testInfo, 'notification-service', 'POST', '/api/confirmations/resend', { confirmationNumber: r.body.confirmationNumber, lastName: b['guest.lastName'] })";
const BOOK = ['const cart = await createCart(request, testInfo, b);', 'expect(cart.status).toBe(201);', 'const r = await reserve(request, testInfo, cart.body.cartId, b);', 'expect(r.status).toBe(201);'];

function caseLines(tc) {
  const e = tc.expected;
  if (tc.kind === 'stay') {
    return ['const s = await search(request, testInfo, b);', `expect(s.status).toBe(${e.status});`,
      ...(e.code ? [`expect(s.body.code).toBe('${e.code}');`, "expect(s.body.fieldIssues).toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: 'stay.tooLong' })]));"] : ['expect(s.body.searchId).toMatch(/^S-/);'])];
  }
  if (tc.kind === 'cancellation') {
    return [...BOOK, "const c = await call(request, testInfo, 'reservation-service', 'POST', `/api/reservations/${r.body.reservationId}/cancel`, {});",
      `expect(c.status).toBe(${e.status});`, ...(e.code ? [`expect(c.body.code).toBe('${e.code}');`] : ["expect(c.body.paymentStatus).toBe('VOIDED');"]),
      "const v = await call(request, testInfo, 'reservation-service', 'GET', `/api/reservations/${r.body.reservationId}`);",
      `expect(v.body.status).toBe('${e.reservationStatus}');`];
  }
  if (tc.kind === 'resend') {
    return [...BOOK, `for (let i = 1; i < ${tc.attempt}; i += 1) await ${RESEND};`, `const last = await ${RESEND};`, `expect(last.status).toBe(${e.status});`, ...(e.code ? [`expect(last.body.code).toBe('${e.code}');`] : [])];
  }
  return ['const cart = await createCart(request, testInfo, b);', 'expect(cart.status).toBe(201);',
    `expect(Math.round((Date.parse(cart.body.expiresAt) - Date.parse(cart.body.createdAt)) / 60000)).toBe(${e.minutes});`];
}

const specName = (title) => `lab-${String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)}.spec.js`;

/** Automation agent: the Playwright spec for the case. */
function renderLabSpec(tc, booking) {
  return `// Test Lab case: ${tc.title}
// Hotel release ${RULES[tc.build].release} (${tc.build}); expected: ${tc.expected.summary}
const { test, expect } = require('@playwright/test');

${HOTEL_PRELUDE}

test(${JSON.stringify(`LAB-T1 ${tc.title}`)}, async ({ request }, testInfo) => {
  const b = ${JSON.stringify(booking)};
  await fresh(request, testInfo);
${caseLines(tc).map((l) => `  ${l}`).join('\n')}
});
`;
}

// The call whose answer decides the case, by evidence title ("<METHOD> <service><path>").
const DECISIVE = { stay: /^POST search-service\/api\/searches$/, cancellation: /\/cancel$/, resend: /resend$/, cart: /^POST cart-service\/api\/carts$/ };
const ENDPOINT = { stay: 'POST search-service /api/searches', cancellation: 'POST reservation-service /api/reservations/{id}/cancel', resend: 'POST notification-service /api/confirmations/resend', cart: 'POST cart-service /api/carts' };

function actualOf(tc, response, viewed) {
  if (!response) return { summary: 'no response recorded' };
  const b = response.body || {};
  if (tc.kind === 'cart') {
    const minutes = b.expiresAt && b.createdAt ? Math.round((Date.parse(b.expiresAt) - Date.parse(b.createdAt)) / 60000) : null;
    return { status: response.status, minutes, summary: `Cart created (HTTP ${response.status}), expires after ${minutes ?? '?'} minutes` };
  }
  const reservationStatus = tc.kind === 'cancellation' ? (viewed && viewed.body && viewed.body.status) || b.status || null : undefined;
  const code = b.code || null;
  const summary = tc.kind === 'stay' ? (response.status === 200 ? 'HTTP 200 with search results' : `HTTP ${response.status}${code ? ` ${code}` : ''}`)
    : tc.kind === 'resend' ? `Resend ${tc.attempt} returns HTTP ${response.status}${code ? ` ${code}` : ''}`
      : `HTTP ${response.status}${code ? ` ${code}` : ''}, reservation ${reservationStatus}`;
  return { status: response.status, code, reservationStatus, summary };
}

/** Execution + defect agents: runs the spec for real against the chosen hotel release and compares expected with actual. */
async function runLabCase(input, runDir) {
  const data = generateData(input);
  const tc = data.testCase;
  const file = specName(tc.title);
  const code = renderLabSpec(tc, data.booking);
  const exec = await executeSuite({
    scripts: [{ file, code }],
    testCases: [{ key: 'LAB-T1', name: tc.title, type: 'Functional', automation: 'Automated', scriptFile: file }],
    runDir,
    sutBuild: tc.build,
  });
  const res = exec.results[0];
  const calls = (res.evidence || []).filter((e) => e.contentType === 'application/json')
    .map((e) => ({ name: e.name, ...JSON.parse(fs.readFileSync(path.join(runDir, 'evidence', e.file), 'utf8')) }));
  const decisive = calls.filter((c) => DECISIVE[tc.kind].test(c.name || '')).pop();
  const viewed = calls.filter((c) => /^GET reservation-service\/api\/reservations\//.test(c.name || '')).pop();
  const actual = actualOf(tc, decisive && decisive.response, viewed && viewed.response);
  const e = tc.expected;
  const checks = [['HTTP status', e.status, actual.status]];
  if (e.code !== undefined && (e.code || actual.code)) checks.push(['Error code', e.code || 'none', actual.code || 'none']);
  if (e.reservationStatus) checks.push(['Reservation status', e.reservationStatus, actual.reservationStatus || '?']);
  if (e.minutes) checks.push(['Cart hold (minutes)', e.minutes, actual.minutes ?? '?']);
  const passed = res.status === 'passed';
  const r = RULES[tc.build];
  const result = {
    status: passed ? 'passed' : 'failed',
    testCase: tc,
    data,
    script: { file, code },
    expected: e.summary,
    actual: actual.summary,
    checks: checks.map(([label, want, got]) => ({ label, expected: String(want), actual: String(got), match: String(want) === String(got) })),
    error: res.error,
    durationMs: res.duration,
    execution: { tool: exec.tool, command: exec.command, sut: exec.sut, startedAt: exec.startedAt, finishedAt: exec.finishedAt },
    defect: null,
  };
  if (!passed) {
    result.defect = {
      title: `${tc.title}: ${actual.summary} instead of ${e.summary}`,
      severity: tc.kind === 'cart' ? 'Major' : 'Critical',
      build: tc.build,
      expected: e.summary,
      actual: actual.summary,
      cause: `Release ${r.release} does not follow the rule "${data.byRules.rule}"`,
      steps: [
        'Build the full booking from the hotel data dictionary',
        data.drivers.length ? `Set ${data.drivers.map((d) => `${d.name}=${d.value}`).join(', ')}` : 'Keep the standard booking',
        ENDPOINT[tc.kind],
        `Expect ${e.summary}`,
      ],
    };
  }
  fs.writeFileSync(path.join(runDir, 'lab-result.json'), JSON.stringify(result, null, 2));
  return result;
}

const labMeta = () => ({ demos: DEMOS, examples: EXAMPLES, builds: Object.keys(RULES), rules: RULES });

module.exports = { DEMOS, EXAMPLES, RULES, labMeta, readPlainEnglish, generateData, renderLabSpec, runLabCase };
