'use strict';
// Test Lab: a person writes one test case in plain English, the platform generates the full reservation test data,
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
    text: 'A 10-night direct booking should earn base 10% plus the 1.5% long-stay bonus: USD 92 commission.',
  },
  {
    id: 'defect',
    name: 'Defect path',
    summary: 'A stay of exactly 7 nights should also earn the bonus ("7 nights or more"). Release 1.0 checks "more than 7", so the test fails and a defect is raised.',
    text: 'A direct booking of exactly 7 nights should earn the long-stay bonus, because the rule is 7 nights or more: USD 92 commission.',
  },
];

const EXAMPLES = [
  'A 3-night GDS booking with a total of USD 2,000 should earn 11.5% commission.',
  'A cancelled booking should earn no commission.',
  'A 2-night corporate booking on release 2.0 should earn 5%.',
  'A booking paid with loyalty points should earn no commission.',
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

const PLAIN = {
  status: { CONFIRMED: 'Confirmed', CHECKED_OUT: 'Checked out', CANCELLED: 'Cancelled', NO_SHOW: 'No-show' },
  channel: { DIRECT: 'Direct (hotel or brand website)', GDS: 'GDS (travel agents)', OTA: 'Online travel agency', CALL_CENTER: 'Call centre' },
  ratePlan: { BAR: 'Best available rate', CORP: 'Corporate', PKG: 'Package', GROUP: 'Group rate', PROMO: 'Promotional' },
};
const LABELS = { status: 'Booking status', channel: 'Booking channel', nights: 'Nights', ratePlan: 'Rate plan', rooms: 'Rooms', loyalty: 'Paid with loyalty points',
  totalAmount: 'Booking total', taxAmount: 'Tax', resortFeeAmount: 'Resort fee', ancillaryAmount: 'Extras (ancillaries)' };
const MONEY_FIELDS = ['totalAmount', 'taxAmount', 'resortFeeAmount', 'ancillaryAmount'];
const RATE_NAMES = { base: 'base commission', gds: 'GDS uplift', longStay: 'long-stay bonus', corporate: 'corporate rate', group: 'group rate', packagePct: 'package room share' };

const WORDS = {
  status: [[/cancel+ed|cancellation/, 'CANCELLED'], [/no[\s-]?show/, 'NO_SHOW'], [/checked[\s-]?out/, 'CHECKED_OUT'], [/\bconfirmed\b/, 'CONFIRMED']],
  channel: [[/\bgds\b|global distribution|travel agents?\b/, 'GDS'], [/\bota\b|online travel|expedia|booking\.com/, 'OTA'], [/call[\s-]?cent(er|re)|by phone|phone booking/, 'CALL_CENTER'], [/\bdirect\b|brand (web)?site|hotel (web)?site/, 'DIRECT']],
  ratePlan: [[/corporate|negotiated/, 'CORP'], [/\bpackage\b/, 'PKG'], [/\bpromo(tion|tional)?\b/, 'PROMO'], [/group rate\b|group plan\b/, 'GROUP'], [/best available|\bbar\b/, 'BAR']],
};
const MONEY_KEYS = [
  ['taxAmount', /\btax(es)?\b/], ['resortFeeAmount', /resort fee|\bfees?\b/], ['ancillaryAmount', /ancillar(y|ies)|\bextras?\b|add[\s-]?ons?/],
  ['expected', /commission|\bearns?\b|\bearning\b|\bpays?\b|\bpaid\b|payout|\breceives?\b|\bgets?\b|expect(ed|s)?\b|should be/],
  ['totalAmount', /\btotal\b|\bworth\b|\bvalued?\b|\bcost(s|ing)?\b|\bpriced?\b|\bprice\b|\bbooking\b|\bstay\b|\breservation\b|\bspend(ing)?\b|\bbill\b/],
];
const RATE_KEYS = [
  ['longStay', /long[\s-]?stay/], ['gds', /\bgds\b|uplift/], ['base', /\bbase\b/], ['corporate', /corporate/], ['group', /\bgroup\b/], ['packagePct', /package|room component/],
  ['total', /commission|\bearns?\b|\bpays?\b|\breceives?\b|\bgets?\b|expect|\btotal\b|\brate\b|should be/],
];
const UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const NUMBER_WORD_RE = new RegExp(`\\b(?:(${TENS.slice(2).join('|')})(?:[\\s-](${UNITS.slice(1, 10).join('|')}))?|(${UNITS.join('|')}))\\b(?=[\\s-]*(?:nights?|rooms?|weeks?)\\b)`, 'g');
const numberWord = (m, tens, unit, small) => String(small ? UNITS.indexOf(small) : TENS.indexOf(tens) * 10 + (unit ? UNITS.indexOf(unit) : 0));
const NEGATED = /\b(?:not|non|isn't|isnt|wasn't|wasnt|never|no longer)\b[\s-]*(?:\w+\s+)?$/;
const usdText = (n) => `USD ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const plainValue = (f, v) => (PLAIN[f] ? PLAIN[f][v] : MONEY_FIELDS.includes(f) ? usdText(v) : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v));
const listText = (xs, conj = 'and') => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${conj} ${xs[xs.length - 1]}`);

function nearestKey(before, after, table) {
  let best = null;
  for (const [key, re] of table) {
    const g = new RegExp(re.source, 'g');
    for (const m of before.matchAll(g)) {
      const d = before.length - (m.index + m[0].length);
      if (!best || d < best.d) best = { key, d };
    }
    for (const m of after.matchAll(g)) if (!best || m.index < best.d) best = { key, d: m.index };
  }
  return best && best.key;
}

/**
 * Reads a test case written in plain English into a structured case, filling what it does not mention from the
 * standard booking. Throws 400 with plain-language problems when the sentence cannot be turned into a test that
 * agrees with the business rules.
 */
function readPlainEnglish(raw) {
  const original = String(raw || '').trim();
  const fail = (headline, problems) => { throw httpError(400, headline, problems.map((message) => ({ field: 'text', message }))); };
  if (!original) fail('Write the test case first', ['Describe the booking in a sentence and, if you like, what commission it should earn.']);
  const text = original.toLowerCase()
    .replace(NUMBER_WORD_RE, numberWord)
    .replace(/\bfortnight\b/g, '14 nights').replace(/\b(a|one) week\b/g, '7 nights');
  const problems = [];
  if (/(^|[\s(:=])(-|minus\s)\s*\d/.test(text)) problems.push('Nights, rooms, amounts and rates cannot be negative. Remove the minus sign.');
  const tokens = [];
  const scan = (kind, re, value) => { for (const m of text.matchAll(re)) tokens.push({ kind, value: value(m), start: m.index, end: m.index + m[0].length, raw: m[0] }); };
  const num = (x) => Number(String(x).replace(/,/g, ''));
  scan('money', /(?:usd|us\$|\$)\s*(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s*(?:usd|dollars?)\b/g, (m) => num(m[1] || m[2]));
  scan('percent', /(\d+(?:\.\d+)?)\s*(?:%|percent\b)/g, (m) => num(m[1]));
  scan('release', /\b(?:release|version|v)\s*([12])(?:\.0)?\b/g, (m) => Number(m[1]));
  scan('nights', /(\d+)[\s-]*nights?\b/g, (m) => num(m[1]));
  scan('nights', /(\d+)[\s-]*weeks?\b/g, (m) => num(m[1]) * 7);
  scan('rooms', /(\d+)[\s-]*rooms?\b/g, (m) => num(m[1]));
  tokens.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept = tokens.filter((t, i) => !tokens.slice(0, i).some((o) => o.start < t.end && t.start < o.end));
  const said = {};
  const rates = [];
  const one = (field, value, what) => {
    if (said[field] !== undefined && said[field] !== value) problems.push(`Your test gives two different ${what} (${plainValue(field, said[field])} and ${plainValue(field, value)}). Keep just one.`);
    else said[field] = value;
  };
  let release = null;
  kept.forEach((t, i) => {
    const before = text.slice(i ? kept[i - 1].end : 0, t.start);
    const after = text.slice(t.end, i + 1 < kept.length ? kept[i + 1].start : text.length);
    if (t.kind === 'nights') one('nights', t.value, 'lengths of stay');
    else if (t.kind === 'rooms') one('rooms', t.value, 'room counts');
    else if (t.kind === 'release') release = t.value;
    else if (t.kind === 'money') {
      const key = nearestKey(before, after, MONEY_KEYS);
      if (!key) problems.push(`I can see "${t.raw.toUpperCase()}" but can't tell what it is. Say whether it is the booking total, the tax, the resort fee, the extras or the commission you expect.`);
      else if (key === 'expected') one('expected', t.value, 'expected commissions');
      else one(key, t.value, `amounts for the ${LABELS[key].toLowerCase()}`);
    } else if (t.kind === 'percent') {
      const key = nearestKey(before, after, RATE_KEYS);
      if (!key) problems.push(`I can see "${t.raw}" but can't tell which rate it is. Say whether it is the total commission rate or a named rule, such as the long-stay bonus.`);
      else rates.push({ key, value: t.value, raw: t.raw });
    }
  });
  for (const [field, list] of Object.entries(WORDS)) {
    const found = list.flatMap(([re, v]) => [...text.matchAll(new RegExp(re.source, 'g'))].map((m) => ({ v, word: m[0], negated: NEGATED.test(text.slice(Math.max(0, m.index - 24), m.index)) })));
    for (const f of found.filter((x) => x.negated)) {
      problems.push(`Your test says what the ${LABELS[field].toLowerCase()} is not ("not ${f.word}"). Say what it is instead, for example ${listText(Object.values(PLAIN[field]).filter((x) => x !== PLAIN[field][f.v]).slice(0, 2).map((x) => `"${x}"`), 'or')}.`);
    }
    const hits = [...new Set(found.filter((x) => !x.negated).map((x) => x.v))];
    if (hits.length > 1) problems.push(`Your test mentions more than one ${LABELS[field].toLowerCase()} (${listText(hits.map((v) => PLAIN[field][v]))}). A booking has only one; keep the one you mean.`);
    else if (hits.length) said[field] = hits[0];
  }
  if (/(not|without|no)\s+(loyalty\s+)?points|paid by (credit )?card|in cash/.test(text)) said.loyalty = false;
  else if (/loyalty points|(paid|pays|paying) (with|in|using) points|points redemption|redeem(ed|s|ing)? points/.test(text)) said.loyalty = true;
  if (said.expected === undefined && /\bno commission|zero commission|not (earn|be paid|get|receive)|\bnothing\b/.test(text)) said.expected = 0;

  let rest = text;
  for (const t of [...kept].reverse()) rest = rest.slice(0, t.start) + ' '.repeat(t.end - t.start) + rest.slice(t.end);
  for (const m of rest.matchAll(/\S*\d[\d.,]*\S*(?:\s+[a-z]+)?/g)) {
    if (m[0].startsWith('-')) continue;
    problems.push(`I can't tell what "${m[0].trim()}" means for commission. The rules only look at the booking status, channel, nights, rooms, rate plan, loyalty points and the amounts (total, tax, resort fee, extras). Remove it or say it in those terms.`);
  }
  if (said.nights === undefined && /\bnights?\b|\bweeks?\b/.test(text)) problems.push('Your test mentions nights but I can\'t tell how many. Write the number, for example "7 nights".');
  if (said.rooms === undefined && /\b(?:many|several|some|multiple|few|lots of)\s+rooms\b/.test(text)) problems.push('Your test mentions rooms but I can\'t tell how many. Write the number, for example "12 rooms".');
  const facts = Object.keys(said).filter((k) => k !== 'expected');
  if (!facts.length && said.expected === undefined && !rates.length && !problems.length) {
    fail('The platform could not find a booking in your test', ['Describe the booking the test is about, for example how many nights, the booking channel (direct, GDS, online travel agency) or the rate plan, and what commission it should earn.']);
  }
  if (said.nights !== undefined && said.nights < 1) problems.push('A stay has to be at least 1 night.');
  if (said.rooms !== undefined && said.rooms < 1) problems.push('A booking needs at least 1 room.');
  if (problems.length) fail('The platform could not turn this into a test yet', problems);

  const notes = [];
  const v2Only = said.ratePlan === 'CORP' || said.ratePlan === 'PKG' || (said.rooms || 0) >= RULES['demo/commission-engine-v2'].groupRooms || rates.some((r) => ['corporate', 'group', 'packagePct'].includes(r.key));
  let build = 'demo/commission-engine';
  if (release === 2) build = 'demo/commission-engine-v2';
  else if (release === null && v2Only) {
    build = 'demo/commission-engine-v2';
    notes.push('Corporate rates, package rates and group bookings are release 2.0 rules, so this test runs against release 2.0.');
  } else if (release === 1 && v2Only) notes.push('Release 1.0 has no corporate, package or group rule, so the standard rates apply.');
  const r = RULES[build];

  const given = { ...STD_GIVEN };
  for (const k of Object.keys(STD_GIVEN)) if (said[k] !== undefined) given[k] = said[k];
  const unsaid = ['taxAmount', 'resortFeeAmount', 'ancillaryAmount'].filter((k) => said[k] === undefined);
  const deductions = () => given.taxAmount + given.resortFeeAmount + given.ancillaryAmount;
  if (said.totalAmount !== undefined && given.totalAmount < deductions() && unsaid.length) {
    for (const k of unsaid) given[k] = 0;
    notes.push(`The standard tax, resort fee and extras are more than your booking total, so they are set to 0 for this test (${listText(unsaid.map((k) => LABELS[k].toLowerCase()))}).`);
  }
  if (given.totalAmount < deductions()) {
    fail('The platform could not turn this into a test yet', [`The booking total (${usdText(given.totalAmount)}) is less than the tax, resort fee and extras together (${usdText(deductions())}). The total has to include them.`]);
  }
  const tc = { title: original, text: original, build, given, expected: null };
  const oracle = expectedByRules(tc);
  const why = `by the release ${r.release} rules this booking earns ${usdText(oracle.commission)} (${listText(oracle.applied) || 'no rate applies'}${oracle.lines.length ? ` on ${usdText(oracle.basis)} commissionable revenue` : ''})`;
  const mismatch = [];
  for (const rt of rates) {
    if (rt.key === 'total') {
      const want = oracle.lines.length ? oracle.ratePct : 0;
      if (Math.abs(want - rt.value) > 1e-9) mismatch.push(`Your test says the commission rate is ${rt.raw}, but ${why}, a rate of ${want}%.`);
    } else if (r[rt.key] === undefined) mismatch.push(`Release ${r.release} has no ${RATE_NAMES[rt.key]}. Say "release 2.0" if you want to test it.`);
    else if (r[rt.key] !== rt.value) mismatch.push(`Your test says the ${RATE_NAMES[rt.key]} is ${rt.raw}, but the specs set it at ${r[rt.key]}%.`);
  }
  if (said.expected !== undefined && Math.abs(said.expected - oracle.commission) > 0.005) {
    mismatch.push(`Your test expects ${usdText(said.expected)}, but ${why}.`);
  }
  if (mismatch.length) fail('Your expected result does not match the specs', [...mismatch, 'Correct the number, or leave it out and the platform will work out the expected commission from the rules.']);
  tc.expected = oracle.commission;
  const reading = Object.keys(STD_GIVEN).map((k) => ({ field: k, label: LABELS[k], value: plainValue(k, given[k]), from: said[k] !== undefined ? 'your test' : unsaid.includes(k) && given[k] === 0 && STD_GIVEN[k] ? 'set to 0 (see note)' : 'standard booking' }));
  reading.push({ field: 'build', label: 'Engine release', value: r.release, from: release !== null ? 'your test' : v2Only ? 'from the rules you mention' : 'standard (release 1.0)' });
  reading.push({ field: 'expected', label: 'Expected commission', value: usdText(tc.expected), from: said.expected !== undefined || rates.length ? 'your test, checked against the specs' : 'worked out from the specs' });
  return { testCase: tc, reading, notes };
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
function generateData(input = {}) {
  const read = typeof input.text === 'string' ? readPlainEnglish(input.text) : null;
  const tc = read ? read.testCase : normaliseCase(input);
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
    reading: read ? read.reading : null,
    notes: read ? read.notes : [],
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

module.exports = { DEMOS, EXAMPLES, FIELDS, readPlainEnglish, normaliseCase, generateData, expectedByRules, renderLabSpec, runLabCase };
