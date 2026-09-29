'use strict';
// Deterministic test-design catalogue: statement pattern -> business rule kind -> test cases -> Playwright code.
// Every parameter used in a case or an assertion comes from the requirement's own values.
// Domain: travel-advisor commission calculated from reservation attributes (1000-attribute reservation model).
const { extractValues } = require('../text');

const round = (x, dp = 2) => { const f = 10 ** dp; return Math.round((x + Number.EPSILON) * f) / f; };
const trunc = (x, dp = 2) => { const f = 10 ** dp; return Math.floor(x * f) / f; };
const money = (n) => `USD ${Number(n).toFixed(2)}`;

// Standard transient reservation: commissionable room revenue 800.00 (1000.00 gross - 120.00 tax - 30.00 resort fee - 50.00 ancillaries).
const REVENUE = { 'revenue.totalAmount': 1000, 'revenue.taxAmount': 120, 'revenue.resortFeeAmount': 30, 'revenue.ancillaryAmount': 50 };
const COMMISSIONABLE = 800;
const STD = { 'reservation.status': 'CONFIRMED', 'channel.bookingChannel': 'DIRECT', 'stay.nights': 3, 'rate.planCategory': 'BAR', 'room.roomCount': 1, 'payment.loyaltyPointsRedemption': false, ...REVENUE };
const flat = (amount) => ({ 'revenue.totalAmount': amount, 'revenue.taxAmount': 0, 'revenue.resortFeeAmount': 0, 'revenue.ancillaryAmount': 0 });

const data = (o) => `${Object.entries(o).map(([k, v]) => `${k}=${v}`).join('; ')}; every other attribute of the 1000-attribute reservation from the data dictionary examples`;
const quoteCode = (o) => `  const r = await quote(request, testInfo, ${JSON.stringify(o)});`;
const STEPS = (what) => ['Build a full reservation from the SUT data dictionary (all attributes, dictionary example values)', `Override the commission drivers: ${what}`, 'POST /api/commission/quote', 'Read the commission breakdown'];

const CATALOGUE = [
  {
    kind: 'base-commission-rate',
    title: 'Base commission rate',
    match: /base commission is (\d+(?:\.\d+)?)\s*%/i,
    params: (m) => ({ pct: Number(m[1]) }),
    cases: ({ pct }) => {
      const expected = round((COMMISSIONABLE * pct) / 100);
      return [{
        slot: 'base', name: `Base commission is ${pct}% of commissionable room revenue`,
        objective: `Verify a standard direct reservation earns ${pct}% of its commissionable room revenue.`,
        precondition: 'Direct booking, 3 nights, BAR rate, 1 room, paid by card.', varies: [],
        steps: STEPS('standard direct reservation'), testData: data(STD),
        expected: `HTTP 200, effective rate ${pct}% and commission ${money(expected)} (${pct}% of ${money(COMMISSIONABLE)})`,
        code: () => `${quoteCode(STD)}
  expect(r.status).toBe(200);
  expect(r.body.effectiveRatePct).toBe(${pct});
  expect(r.body.commission).toBe(${expected});`,
      }];
    },
  },
  {
    kind: 'commissionable-revenue',
    title: 'Commissionable room revenue',
    match: /commissionable room revenue excludes taxes/i,
    params: () => ({}),
    cases: () => [{
      slot: 'revenue', name: 'Taxes, resort fees and ancillaries are excluded from commissionable revenue',
      objective: 'Verify commissionable room revenue = total - taxes - resort fees - ancillary charges.',
      precondition: 'A reservation whose total includes tax, resort fee and ancillary charges.',
      varies: ['revenue.taxAmount', 'revenue.resortFeeAmount', 'revenue.ancillaryAmount'],
      steps: STEPS('revenue.totalAmount 1000.00 with tax 120.00, resort fee 30.00, ancillaries 50.00'), testData: data(STD),
      expected: `HTTP 200 and commissionableRevenue = ${money(COMMISSIONABLE)}`,
      code: () => `${quoteCode(STD)}
  expect(r.status).toBe(200);
  expect(r.body.commissionableRevenue).toBe(${COMMISSIONABLE});`,
    }],
  },
  {
    kind: 'gds-channel-uplift',
    title: 'GDS channel uplift',
    match: /GDS channel earn an additional (\d+(?:\.\d+)?)\s*%/i,
    params: (m) => ({ pct: Number(m[1]) }),
    dependsOn: ['base-commission-rate'],
    cases: ({ pct }, ctx) => {
      const base = ctx.paramsOf('base-commission-rate')?.pct;
      if (base === undefined) return null;
      const o = { ...STD, 'channel.bookingChannel': 'GDS' };
      const rate = round(base + pct, 4);
      const expected = round((COMMISSIONABLE * rate) / 100);
      return [{
        slot: 'gds', name: `GDS reservations earn an additional ${pct}% channel uplift`,
        objective: `Verify a GDS booking is commissioned at ${base}% base + ${pct}% uplift = ${rate}%.`,
        precondition: 'GDS booking, 3 nights, BAR rate, 1 room.', varies: ['channel.bookingChannel'],
        steps: STEPS('channel.bookingChannel=GDS'), testData: data(o),
        expected: `HTTP 200, effective rate ${rate}% and commission ${money(expected)}`,
        code: () => `${quoteCode(o)}
  expect(r.status).toBe(200);
  expect(r.body.effectiveRatePct).toBe(${rate});
  expect(r.body.commission).toBe(${expected});`,
      }];
    },
  },
  {
    kind: 'long-stay-bonus',
    title: 'Long-stay bonus',
    match: /stays of (\d+) nights or more earn a long-stay bonus of (\d+(?:\.\d+)?)\s*%/i,
    params: (m) => ({ nights: Number(m[1]), pct: Number(m[2]) }),
    dependsOn: ['base-commission-rate'],
    cases: ({ nights, pct }, ctx) => {
      const base = ctx.paramsOf('base-commission-rate')?.pct;
      if (base === undefined) return null;
      const at = { ...STD, 'stay.nights': nights };
      const below = { ...STD, 'stay.nights': nights - 1 };
      const rate = round(base + pct, 4);
      const withBonus = round((COMMISSIONABLE * rate) / 100);
      const without = round((COMMISSIONABLE * base) / 100);
      return [{
        slot: 'at', name: `A stay of exactly ${nights} nights earns the ${pct}% long-stay bonus`,
        objective: `Verify the long-stay bonus applies at the ${nights}-night boundary ("${nights} nights or more").`,
        precondition: `Direct booking of exactly ${nights} nights.`, varies: ['stay.nights'],
        steps: STEPS(`stay.nights=${nights}`), testData: data(at),
        expected: `HTTP 200, effective rate ${rate}% and commission ${money(withBonus)}`,
        code: () => `${quoteCode(at)}
  expect(r.status).toBe(200);
  expect(r.body.commission).toBe(${withBonus});`,
      }, {
        slot: 'below', name: `A stay of ${nights - 1} nights earns no long-stay bonus`,
        objective: `Verify the long-stay bonus does not apply below ${nights} nights.`,
        precondition: `Direct booking of ${nights - 1} nights.`, varies: ['stay.nights'],
        steps: STEPS(`stay.nights=${nights - 1}`), testData: data(below),
        expected: `HTTP 200, effective rate ${base}% and commission ${money(without)}`,
        code: () => `${quoteCode(below)}
  expect(r.status).toBe(200);
  expect(r.body.commission).toBe(${without});`,
      }];
    },
  },
  {
    kind: 'commission-cap',
    title: 'Commission cap per reservation',
    match: /capped at USD (\d+(?:\.\d+)?)/i,
    params: (m) => ({ cap: Number(m[1]) }),
    dependsOn: ['base-commission-rate'],
    cases: ({ cap }, ctx) => {
      const base = ctx.paramsOf('base-commission-rate')?.pct;
      if (base === undefined) return null;
      const total = round((cap * 1.6 * 100) / base);
      const o = { ...STD, ...flat(total) };
      return [{
        slot: 'cap', name: `Commission is capped at USD ${cap} per reservation`,
        objective: `Verify a reservation whose uncapped commission exceeds USD ${cap} pays exactly USD ${cap}.`,
        precondition: `High-value direct booking: uncapped commission ${money(round((total * base) / 100))}.`, varies: ['revenue.totalAmount'],
        steps: STEPS(`revenue.totalAmount=${total} (no tax, fees or ancillaries)`), testData: data(o),
        expected: `HTTP 200, capped = true and commission ${money(cap)}`,
        code: () => `${quoteCode(o)}
  expect(r.status).toBe(200);
  expect(r.body.capped).toBe(true);
  expect(r.body.commission).toBe(${cap});`,
      }];
    },
  },
  {
    kind: 'commission-rounding',
    title: 'Commission rounding',
    match: /rounded half-up to (\d+) decimal places?/i,
    params: (m) => ({ dp: Number(m[1]) }),
    dependsOn: ['base-commission-rate'],
    cases: ({ dp }, ctx) => {
      const base = ctx.paramsOf('base-commission-rate')?.pct;
      if (base === undefined) return null;
      const candidates = [123.45, 98.76, 57.35, 10.05, 333.33];
      const total = candidates.find((t) => round((t * base) / 100, dp) !== trunc((t * base) / 100, dp)) || candidates[0];
      const o = { ...STD, ...flat(total) };
      const expected = round((total * base) / 100, dp);
      return [{
        slot: 'round', name: `Commission is rounded half-up to ${dp} decimal places`,
        objective: `Verify ${base}% of ${money(total)} (${(total * base) / 100}) is rounded half-up, not truncated.`,
        precondition: 'Direct booking whose raw commission has a third decimal of 5.', varies: ['revenue.totalAmount'],
        steps: STEPS(`revenue.totalAmount=${total} (no tax, fees or ancillaries)`), testData: data(o),
        expected: `HTTP 200 and commission ${money(expected)}`,
        code: () => `${quoteCode(o)}
  expect(r.status).toBe(200);
  expect(r.body.commission).toBe(${expected});`,
      }];
    },
  },
  {
    kind: 'loyalty-points-exclusion',
    title: 'Loyalty-points stays excluded',
    match: /paid with loyalty points are not commissionable/i,
    params: () => ({}),
    cases: () => {
      const o = { ...STD, 'payment.loyaltyPointsRedemption': true };
      return [{
        slot: 'points', name: 'A stay paid with loyalty points earns no commission',
        objective: 'Verify reservations redeemed with loyalty points are not commissionable.',
        precondition: 'Direct booking paid with loyalty points.', varies: ['payment.loyaltyPointsRedemption'],
        steps: STEPS('payment.loyaltyPointsRedemption=true'), testData: data(o),
        expected: 'HTTP 200, eligible = false and commission USD 0.00',
        code: () => `${quoteCode(o)}
  expect(r.status).toBe(200);
  expect(r.body.eligible).toBe(false);
  expect(r.body.commission).toBe(0);`,
      }];
    },
  },
  {
    kind: 'status-exclusion',
    title: 'Cancelled and no-show reservations excluded',
    match: /cancelled and no-show reservations earn no commission/i,
    params: () => ({}),
    cases: () => [{
      slot: 'status', name: 'Cancelled and no-show reservations earn no commission',
      objective: 'Verify reservation.status CANCELLED and NO_SHOW both return a commission of 0.',
      precondition: 'Two otherwise standard reservations with status CANCELLED and NO_SHOW.', varies: ['reservation.status'],
      steps: STEPS('reservation.status=CANCELLED, then reservation.status=NO_SHOW'), testData: data({ ...STD, 'reservation.status': 'CANCELLED | NO_SHOW' }),
      expected: 'Both quotes: HTTP 200, eligible = false and commission USD 0.00',
      code: () => `  for (const status of ['CANCELLED', 'NO_SHOW']) {
    const r = await quote(request, testInfo, { ...${JSON.stringify(STD)}, 'reservation.status': status });
    expect(r.status).toBe(200);
    expect(r.body.eligible).toBe(false);
    expect(r.body.commission).toBe(0);
  }`,
    }],
  },
  {
    kind: 'missing-iata-status',
    title: 'Advisor IATA number required',
    match: /without an advisor IATA number returns HTTP (\d{3})/i,
    params: (m) => ({ status: Number(m[1]) }),
    cases: ({ status }) => {
      const o = { ...STD, 'advisor.iataNumber': '' };
      return [{
        slot: 'iata', name: `A reservation without an advisor IATA number returns HTTP ${status}`,
        objective: `Verify the quote is rejected with HTTP ${status} when advisor.iataNumber is empty.`,
        precondition: 'A reservation with no booking advisor.', varies: ['advisor.iataNumber'],
        steps: STEPS('advisor.iataNumber empty'), testData: data(o), expected: `HTTP ${status}`,
        code: () => `${quoteCode(o)}
  expect(r.status).toBe(${status});`,
      }];
    },
  },
  {
    kind: 'unknown-reservation-status',
    title: 'Unknown reservation',
    match: /unknown reservation IDs? returns? HTTP (\d{3})/i,
    params: (m) => ({ status: Number(m[1]) }),
    cases: ({ status }) => [{
      slot: 'unknown', name: `Commission for an unknown reservation ID returns HTTP ${status}`,
      objective: `Verify looking up the commission of a non-existent reservation returns HTTP ${status}.`,
      precondition: 'Reservation RES-UNKNOWN-0000 does not exist.', varies: [],
      steps: ['GET /api/reservations/RES-UNKNOWN-0000/commission'], testData: 'id=RES-UNKNOWN-0000', expected: `HTTP ${status}`,
      code: () => `  const r = await call(request, testInfo, 'GET', '/api/reservations/RES-UNKNOWN-0000/commission');
  expect(r.status).toBe(${status});`,
    }],
  },
  {
    kind: 'reservation-data-dictionary',
    title: 'Reservation data dictionary',
    match: /data dictionary of (\d+) attributes/i,
    params: (m) => ({ count: Number(m[1]) }),
    cases: ({ count }) => [{
      slot: 'dictionary', name: `The reservation model has ${count} attributes and a full reservation is accepted`,
      objective: `Verify the data dictionary defines ${count} attributes and a quote carrying all of them is accepted.`,
      precondition: 'The commission engine is running.', varies: [],
      steps: ['GET /api/data-dictionary and count the attributes', 'Quote a reservation carrying every attribute', 'Read attributesReceived'],
      testData: data(STD), expected: `${count} attributes; quote HTTP 200 with attributesReceived = ${count}`,
      code: () => `  const d = await call(request, testInfo, 'GET', '/api/data-dictionary');
  expect(d.status).toBe(200);
  expect(d.body.attributes.length).toBe(${count});
${quoteCode(STD)}
  expect(r.status).toBe(200);
  expect(r.body.attributesReceived).toBe(${count});`,
    }],
  },
  {
    kind: 'quote-latency',
    title: 'Commission quote response time',
    type: 'non-functional',
    match: /within (\d+)\s*ms\b/i,
    params: (m, values) => ({ ms: Number(m[1]), percentile: values.find((v) => v.unit === 'percentile')?.num ?? 95 }),
    cases: ({ ms, percentile }) => [{
      slot: 'p', name: `Commission quote p${percentile} response time is within ${ms} ms`,
      objective: `Verify the ${percentile}th percentile of 20 full-reservation commission quotes is at most ${ms} ms.`,
      precondition: 'The commission engine is running.', varies: [],
      steps: ['Build a full 1000-attribute reservation', 'POST /api/commission/quote 20 times, timing each call', `Compute the p${percentile} latency`],
      testData: `samples=20; ${data(STD)}`, expected: `p${percentile} <= ${ms} ms`,
      code: () => `  const body = { reservation: await reservation(request, ${JSON.stringify(STD)}) };
  const samples = [];
  for (let i = 0; i < 20; i += 1) {
    const t0 = Date.now();
    const res = await request.post('/api/commission/quote', { data: body });
    samples.push(Date.now() - t0);
    expect(res.status()).toBe(200);
  }
  samples.sort((a, b) => a - b);
  const p = samples[Math.ceil((${percentile} / 100) * samples.length) - 1];
  await testInfo.attach('latency samples (ms)', { body: JSON.stringify({ samples, p${percentile}: p }), contentType: 'application/json' });
  expect(p).toBeLessThanOrEqual(${ms});`,
    }],
  },
  {
    kind: 'commission-statement-ui',
    title: 'Advisor commission statement (UI)',
    match: /view the commission breakdown for a reservation online/i,
    params: () => ({}),
    ui: true,
    cases: () => {
      const o = { ...STD, 'channel.bookingChannel': 'GDS' };
      return [{
        slot: 'ui', name: 'Advisor views the commission breakdown on the commission statement page',
        objective: 'Verify a travel advisor can look up a reservation and see its commission breakdown in the browser.',
        precondition: 'A stored GDS reservation; the commission statement page is reachable.', varies: [],
        steps: ['Store a full reservation (POST /api/reservations)', 'Open the commission statement page', 'Enter the reservation ID and click "Show commission"', 'Read the breakdown'],
        testData: data(o), expected: 'Page shows "Commission breakdown", the base commission line and "Total commission"',
        code: () => `  const created = await call(request, testInfo, 'POST', '/api/reservations', { reservation: await reservation(request, ${JSON.stringify(o)}) });
  expect(created.status).toBe(201);
  await page.goto('/');
  await page.fill('#reservation-id', created.body.id);
  await page.click('#show');
  await expect(page.locator('#statement')).toContainText('Commission breakdown');
  await expect(page.locator('#statement')).toContainText('Base commission');
  await expect(page.locator('#statement')).toContainText('Total commission');
  await testInfo.attach('screenshot', { body: await page.screenshot(), contentType: 'image/png' });`,
      }];
    },
  },
  {
    kind: 'group-flat-rate',
    title: 'Group flat rate',
    match: /group reservations of (\d+) or more rooms are commissioned at a flat (\d+(?:\.\d+)?)\s*%/i,
    params: (m) => ({ rooms: Number(m[1]), pct: Number(m[2]) }),
    dependsOn: ['base-commission-rate'],
    cases: ({ rooms, pct }, ctx) => {
      const base = ctx.paramsOf('base-commission-rate')?.pct;
      if (base === undefined) return null;
      const at = { ...STD, 'room.roomCount': rooms };
      const below = { ...STD, 'room.roomCount': rooms - 1 };
      const flatAmt = round((COMMISSIONABLE * pct) / 100);
      const baseAmt = round((COMMISSIONABLE * base) / 100);
      return [{
        slot: 'at', name: `A group of ${rooms} rooms is commissioned at a flat ${pct}%`,
        objective: `Verify a reservation holding ${rooms} rooms uses the flat ${pct}% group rate instead of the transient rates.`,
        precondition: `Direct booking holding ${rooms} rooms.`, varies: ['room.roomCount'],
        steps: STEPS(`room.roomCount=${rooms}`), testData: data(at),
        expected: `HTTP 200, effective rate ${pct}% and commission ${money(flatAmt)}`,
        code: () => `${quoteCode(at)}
  expect(r.status).toBe(200);
  expect(r.body.effectiveRatePct).toBe(${pct});
  expect(r.body.commission).toBe(${flatAmt});`,
      }, {
        slot: 'below', name: `${rooms - 1} rooms keep the transient base rate`,
        objective: `Verify the group rate does not apply below ${rooms} rooms.`,
        precondition: `Direct booking holding ${rooms - 1} rooms.`, varies: ['room.roomCount'],
        steps: STEPS(`room.roomCount=${rooms - 1}`), testData: data(below),
        expected: `HTTP 200, effective rate ${base}% and commission ${money(baseAmt)}`,
        code: () => `${quoteCode(below)}
  expect(r.status).toBe(200);
  expect(r.body.effectiveRatePct).toBe(${base});
  expect(r.body.commission).toBe(${baseAmt});`,
      }];
    },
  },
  {
    kind: 'package-room-component',
    title: 'Package room component',
    match: /package rates are commissioned on (\d+(?:\.\d+)?)\s*% of the package price/i,
    params: (m) => ({ pct: Number(m[1]) }),
    dependsOn: ['base-commission-rate'],
    cases: ({ pct }, ctx) => {
      const base = ctx.paramsOf('base-commission-rate')?.pct;
      if (base === undefined) return null;
      const o = { ...STD, 'rate.planCategory': 'PKG', ...flat(1000) };
      const basis = round((1000 * pct) / 100);
      const expected = round((basis * base) / 100);
      return [{
        slot: 'pkg', name: `Package rates are commissioned on ${pct}% of the package price`,
        objective: `Verify a PKG reservation is commissioned at ${base}% of ${pct}% of the package price.`,
        precondition: 'Package booking priced USD 1000.00 (no tax, fees or ancillaries).', varies: ['rate.planCategory'],
        steps: STEPS('rate.planCategory=PKG, revenue.totalAmount=1000'), testData: data(o),
        expected: `HTTP 200, basis ${money(basis)} and commission ${money(expected)}`,
        code: () => `${quoteCode(o)}
  expect(r.status).toBe(200);
  expect(r.body.basis).toBe(${basis});
  expect(r.body.commission).toBe(${expected});`,
      }];
    },
  },
  {
    kind: 'corporate-flat-rate',
    title: 'Negotiated corporate rate',
    match: /corporate rates\b.*commissioned at a flat (\d+(?:\.\d+)?)\s*%/i,
    params: (m) => ({ pct: Number(m[1]) }),
    cases: ({ pct }) => {
      const o = { ...STD, 'rate.planCategory': 'CORP' };
      const expected = round((COMMISSIONABLE * pct) / 100);
      return [{
        slot: 'corp', name: `Negotiated corporate rates are commissioned at a flat ${pct}%`,
        objective: `Verify a CORP rate-plan reservation is commissioned at ${pct}% with no uplifts or bonuses.`,
        precondition: 'Direct booking on a negotiated corporate rate plan.', varies: ['rate.planCategory'],
        steps: STEPS('rate.planCategory=CORP'), testData: data(o),
        expected: `HTTP 200, effective rate ${pct}% and commission ${money(expected)}`,
        code: () => `${quoteCode(o)}
  expect(r.status).toBe(200);
  expect(r.body.effectiveRatePct).toBe(${pct});
  expect(r.body.commission).toBe(${expected});`,
      }];
    },
  },
];

// Browser journey: the advisor stores a reservation, opens the commission statement and checks what they see.
const journeyCode = (o, total, lines) => `  const created = await call(request, testInfo, 'POST', '/api/reservations', { reservation: await reservation(request, ${JSON.stringify(o)}) });
  expect(created.status).toBe(201);
  await page.goto('/');
  await page.fill('#reservation-id', created.body.id);
  await page.click('#show');
  const statement = page.locator('#statement');
  await expect(statement).toContainText('Commission breakdown');
  await testInfo.attach('statement screenshot', { body: await page.screenshot(), contentType: 'image/png' });
${lines.map((l) => `  await expect(statement).toContainText(${JSON.stringify(l)});`).join('\n')}
  await expect(statement.locator('tr', { hasText: 'Total commission' })).toContainText(${JSON.stringify(money(total))});`;

const journey = ({ slot, name, precondition, o, total, lines, varies = [] }) => ({
  slot: `journey-${slot}`, suite: 'journey', ui: true, name, varies,
  objective: `Verify the travel advisor sees ${lines.join(', ')} and a total of ${money(total)} on the commission statement.`,
  precondition,
  steps: ['Store a full reservation (POST /api/reservations)', 'Open the advisor commission statement page', 'Enter the reservation ID and click "Show commission"',
    `Check the statement lists ${lines.map((l) => `"${l}"`).join(', ')} and the total ${money(total)}`],
  testData: data(o), expected: `Statement shows ${lines.map((l) => `"${l}"`).join(', ')} and Total commission ${money(total)}`,
  code: () => journeyCode(o, total, lines),
});

const baseOf = (ctx) => ctx.paramsOf('base-commission-rate')?.pct;

// Cases a rule adds beyond its functional checks, used by end-to-end and performance runs.
const EXTRAS = {
  'base-commission-rate': ({ pct }) => [journey({ slot: 'base', name: 'Advisor sees the base commission and total on the statement for a standard stay',
    precondition: 'Stored direct booking, 3 nights, BAR rate, 1 room.', o: STD, total: round((COMMISSIONABLE * pct) / 100), lines: ['Base commission'] })],
  'gds-channel-uplift': ({ pct }, ctx) => {
    const base = baseOf(ctx);
    if (base === undefined) return [];
    const o = { ...STD, 'channel.bookingChannel': 'GDS' };
    return [journey({ slot: 'gds', name: 'Advisor sees the GDS uplift line and total on the statement for a GDS booking', precondition: 'Stored GDS booking, 3 nights.',
      o, total: round((COMMISSIONABLE * round(base + pct, 4)) / 100), lines: ['Base commission', 'GDS channel uplift'], varies: ['channel.bookingChannel'] })];
  },
  'long-stay-bonus': ({ nights, pct }, ctx) => {
    const base = baseOf(ctx);
    if (base === undefined) return [];
    const o = { ...STD, 'stay.nights': nights };
    return [journey({ slot: 'long-stay', name: `Advisor sees the long-stay bonus on the statement for a ${nights}-night stay`, precondition: `Stored direct booking of exactly ${nights} nights.`,
      o, total: round((COMMISSIONABLE * round(base + pct, 4)) / 100), lines: ['Base commission', 'Long-stay bonus'], varies: ['stay.nights'] })];
  },
  'commission-cap': ({ cap }, ctx) => {
    const base = baseOf(ctx);
    if (base === undefined) return [];
    const o = { ...STD, ...flat(round((cap * 1.6 * 100) / base)) };
    return [journey({ slot: 'cap', name: `Advisor sees the cap applied and a total of USD ${cap} on a high-value reservation`, precondition: 'Stored high-value direct booking above the cap.',
      o, total: cap, lines: ['Cap applied'], varies: ['revenue.totalAmount'] })];
  },
  'group-flat-rate': ({ rooms, pct }) => [journey({ slot: 'group', name: `Advisor sees the group flat rate on the statement for ${rooms} rooms`, precondition: `Stored direct booking holding ${rooms} rooms.`,
    o: { ...STD, 'room.roomCount': rooms }, total: round((COMMISSIONABLE * pct) / 100), lines: ['Group flat rate'], varies: ['room.roomCount'] })],
  'corporate-flat-rate': ({ pct }) => [journey({ slot: 'corp', name: 'Advisor sees the negotiated corporate rate on the statement', precondition: 'Stored booking on a corporate rate plan.',
    o: { ...STD, 'rate.planCategory': 'CORP' }, total: round((COMMISSIONABLE * pct) / 100), lines: ['Negotiated corporate rate'], varies: ['rate.planCategory'] })],
  'quote-latency': ({ ms, percentile }) => [{
    slot: 'load', suite: 'load', name: `Commission quote p${percentile} stays within ${ms} ms with 5 advisors quoting at once`,
    objective: `Verify the ${percentile}th percentile of 40 full-reservation quotes from 5 concurrent clients is at most ${ms} ms.`,
    precondition: 'The commission engine is running.', varies: [],
    steps: ['Build a full 1000-attribute reservation', 'Start 5 concurrent clients, each posting 8 quotes and timing each call', `Compute the p${percentile} latency over all 40 samples`],
    testData: `clients=5; quotes per client=8; ${data(STD)}`, expected: `p${percentile} <= ${ms} ms under 5 concurrent clients`,
    code: () => `  const body = { reservation: await reservation(request, ${JSON.stringify(STD)}) };
  const samples = [];
  await Promise.all(Array.from({ length: 5 }, async () => {
    for (let i = 0; i < 8; i += 1) {
      const t0 = Date.now();
      const res = await request.post('/api/commission/quote', { data: body });
      samples.push(Date.now() - t0);
      expect(res.status()).toBe(200);
    }
  }));
  samples.sort((a, b) => a - b);
  const p = samples[Math.ceil((${percentile} / 100) * samples.length) - 1];
  await testInfo.attach('latency samples under load (ms)', { body: JSON.stringify({ clients: 5, samples, p${percentile}: p }), contentType: 'application/json' });
  expect(p).toBeLessThanOrEqual(${ms});`,
  }],
};
for (const e of CATALOGUE) if (EXTRAS[e.kind]) e.extras = EXTRAS[e.kind];

function classify(text) {
  const { values } = extractValues(text);
  for (const entry of CATALOGUE) {
    const m = String(text).match(entry.match);
    if (m) return { entry, params: entry.params(m, values) };
  }
  return null;
}

// Helpers every generated spec carries: a full reservation is built from the SUT's own data dictionary.
const SPEC_PRELUDE = `let dictionary = null;

function summarise(data) {
  if (data && data.reservation) {
    const attrs = Object.keys(data.reservation).length;
    return { reservation: \`<\${attrs} attributes>\`, overrides: data.overrides || null };
  }
  return data ?? null;
}

async function call(request, testInfo, method, url, data, overrides) {
  const res = await request.fetch(url, { method, data });
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  const shown = body && Array.isArray(body.attributes) ? { ...body, attributes: \`<\${body.attributes.length} attributes>\` } : body;
  await testInfo.attach(\`\${method} \${url}\`, {
    body: JSON.stringify({ request: { method, url, data: summarise(data && overrides ? { ...data, overrides } : data) }, response: { status: res.status(), body: shown } }, null, 2),
    contentType: 'application/json',
  });
  return { status: res.status(), body };
}

async function reservation(request, overrides) {
  if (!dictionary) dictionary = await (await request.get('/api/data-dictionary')).json();
  const res = {};
  for (const a of dictionary.attributes) res[a.name] = a.example;
  return { ...res, ...overrides };
}

async function quote(request, testInfo, overrides) {
  return call(request, testInfo, 'POST', '/api/commission/quote', { reservation: await reservation(request, overrides) }, overrides);
}`;

const COMMISSION_KINDS = ['base-commission-rate', 'commissionable-revenue', 'gds-channel-uplift', 'long-stay-bonus', 'commission-cap', 'commission-rounding',
  'loyalty-points-exclusion', 'status-exclusion', 'group-flat-rate', 'package-room-component', 'corporate-flat-rate'];
// Rules whose failure pays advisors the wrong amount: High priority cases, Critical defects.
const MONEY_KINDS = new Set(COMMISSION_KINDS);
// Rules whose failure blocks a core advisor journey.
const JOURNEY_KINDS = new Set(['commission-statement-ui']);
// Advisory (non-functional) rules.
const ADVISORY_KINDS = new Set(['quote-latency']);

module.exports = { CATALOGUE, classify, round, trunc, SPEC_PRELUDE, MONEY_KINDS, JOURNEY_KINDS, ADVISORY_KINDS };
