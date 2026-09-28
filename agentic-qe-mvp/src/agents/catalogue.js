'use strict';
// Deterministic test-design catalogue: statement pattern -> business rule kind -> test cases -> Playwright code.
// Every parameter used in a case or an assertion comes from the requirement's own values.
const { extractValues } = require('../text');

const round = (x, dp) => { const f = 10 ** dp; return Math.round((x + Number.EPSILON) * f) / f; };
const trunc = (x, dp) => { const f = 10 ** dp; return Math.floor(x * f) / f; };
const money = (n) => Number(n).toFixed(2);

const CATALOGUE = [
  {
    kind: 'date-change-free-window',
    title: 'Free date-change window',
    match: /date changes?\b.*at least (\d+) hours? before check-in.*no fee/i,
    params: (m) => ({ hours: Number(m[1]) }),
    cases: ({ hours }) => [
      {
        slot: 'free', priority: 'High', name: `Date change ${hours}+ hours before check-in carries no fee`,
        objective: `Verify a date change made at least ${hours} hours before check-in is free.`,
        precondition: `A confirmed booking with check-in ${hours + 48} hours from now.`,
        steps: ['Create a booking (total 150.00) with check-in ' + (hours + 48) + ' hours ahead', 'PATCH the booking with a check-in 7 days later', 'Read changeFee from the response'],
        testData: `total=150.00; checkIn=now+${hours + 48}h`, expected: `HTTP 200 and changeFee = 0 (inside the ${hours}-hour free window rule)`,
        code: () => `  const booking = await book(request, testInfo, 150, ${hours + 48});
  const r = await call(request, testInfo, 'PATCH', \`/api/bookings/\${booking.id}\`, { checkIn: inHours(${hours + 48} + 24 * 7) });
  expect(r.status).toBe(200);
  expect(r.body.changeFee).toBe(0);`,
      },
      ...(hours > 1 ? [{
        slot: 'late', priority: 'Medium', name: `Date change less than ${hours} hours before check-in is charged`,
        objective: `Verify a date change made inside ${hours} hours of check-in is not free.`,
        precondition: `A confirmed booking with check-in ${hours - 1} hours from now.`,
        steps: [`Create a booking (total 150.00) with check-in ${hours - 1} hours ahead`, 'PATCH the booking with a check-in 7 days later', 'Read changeFee from the response'],
        testData: `total=150.00; checkIn=now+${hours - 1}h`, expected: 'HTTP 200 and changeFee > 0',
        code: () => `  const booking = await book(request, testInfo, 150, ${hours - 1});
  const r = await call(request, testInfo, 'PATCH', \`/api/bookings/\${booking.id}\`, { checkIn: inHours(24 * 7) });
  expect(r.status).toBe(200);
  expect(r.body.changeFee).toBeGreaterThan(0);`,
      }] : []),
    ],
  },
  {
    kind: 'free-cancellation-window',
    title: 'Free cancellation window',
    match: /cancell\w*\b.*at least (\d+) hours? before check-in.*free/i,
    params: (m) => ({ hours: Number(m[1]) }),
    cases: ({ hours }) => [
      {
        slot: 'free', priority: 'High', name: `Cancellation ${hours}+ hours before check-in is free`,
        objective: `Verify no fee is charged and the full amount is refunded when cancelling at least ${hours} hours before check-in.`,
        precondition: `A confirmed booking with check-in ${hours + 24} hours from now.`,
        steps: [`Create a booking (total 180.00) with check-in ${hours + 24} hours ahead`, 'Cancel the booking', 'Read fee and refund from the response'],
        testData: `total=180.00; checkIn=now+${hours + 24}h`, expected: 'HTTP 200, fee = 0 and refund = 180.00',
        code: () => `  const booking = await book(request, testInfo, 180, ${hours + 24});
  const r = await call(request, testInfo, 'POST', \`/api/bookings/\${booking.id}/cancel\`);
  expect(r.status).toBe(200);
  expect(r.body.fee).toBe(0);
  expect(r.body.refund).toBe(180);`,
      },
      ...(hours > 1 ? [{
        slot: 'late', priority: 'Medium', name: `Cancellation less than ${hours} hours before check-in is charged`,
        objective: `Verify the free-cancellation window ends ${hours} hours before check-in.`,
        precondition: `A confirmed booking with check-in ${hours - 1} hours from now.`,
        steps: [`Create a booking (total 180.00) with check-in ${hours - 1} hours ahead`, 'Cancel the booking', 'Read fee from the response'],
        testData: `total=180.00; checkIn=now+${hours - 1}h`, expected: 'HTTP 200 and fee > 0',
        code: () => `  const booking = await book(request, testInfo, 180, ${hours - 1});
  const r = await call(request, testInfo, 'POST', \`/api/bookings/\${booking.id}/cancel\`);
  expect(r.status).toBe(200);
  expect(r.body.fee).toBeGreaterThan(0);`,
      }] : []),
    ],
  },
  {
    kind: 'late-cancellation-fee',
    title: 'Late cancellation fee',
    match: /late cancellation fee\W+(?:is\s+)?(\d+(?:\.\d+)?)\s*%/i,
    params: (m) => ({ pct: Number(m[1]) }),
    cases: ({ pct }) => {
      const fee = round((200 * pct) / 100, 2);
      return [{
        slot: 'fee', priority: 'High', name: `Late cancellation fee is ${pct}% of the booking total`,
        objective: `Verify a late cancellation is charged ${pct}% of the booking total.`,
        precondition: 'A confirmed booking with check-in 1 hour from now (inside any free window).',
        steps: ['Create a booking (total 200.00) with check-in 1 hour ahead', 'Cancel the booking', 'Read fee from the response'],
        testData: 'total=200.00; checkIn=now+1h', expected: `HTTP 200 and fee = ${money(fee)} (${pct}% of 200.00)`,
        code: () => `  const booking = await book(request, testInfo, 200, 1);
  const r = await call(request, testInfo, 'POST', \`/api/bookings/\${booking.id}/cancel\`);
  expect(r.status).toBe(200);
  expect(r.body.fee).toBe(${fee});`,
      }];
    },
  },
  {
    kind: 'refund-sla',
    title: 'Refund SLA',
    match: /refunds?\b.*within (\d+) (?:business )?days?/i,
    params: (m) => ({ days: Number(m[1]) }),
    cases: ({ days }) => [{
      slot: 'sla', priority: 'High', name: `Refund is due within ${days} days of cancellation`,
      objective: `Verify the refund due date is ${days} days after the cancellation time.`,
      precondition: 'A confirmed booking with check-in 7 days from now.',
      steps: ['Create a booking (total 200.00) with check-in 7 days ahead', 'Cancel the booking', 'Compute refundDueBy - cancelledAt in days'],
      testData: 'total=200.00; checkIn=now+168h', expected: `HTTP 200 and refund due exactly ${days} days after cancellation`,
      code: () => `  const booking = await book(request, testInfo, 200, 24 * 7);
  const r = await call(request, testInfo, 'POST', \`/api/bookings/\${booking.id}/cancel\`);
  expect(r.status).toBe(200);
  const days = (Date.parse(r.body.refundDueBy) - Date.parse(r.body.cancelledAt)) / (24 * HOUR);
  expect(days).toBe(${days});`,
    }],
  },
  {
    kind: 'money-rounding',
    title: 'Refund rounding',
    match: /rounded to (\d+) decimal places?/i,
    params: (m) => ({ dp: Number(m[1]) }),
    dependsOn: ['late-cancellation-fee'],
    cases: ({ dp }, ctx) => {
      const pct = ctx.paramsOf('late-cancellation-fee')?.pct;
      if (pct === undefined) return null;
      const candidates = [123.47, 99.99, 57.33, 88.88, 145.67, 10.01, 333.33];
      const total = candidates.find((t) => round(t * (1 - pct / 100), dp) !== trunc(t * (1 - pct / 100), dp)) || candidates[0];
      const raw = total - (total * pct) / 100;
      const expected = round(raw, dp);
      return [{
        slot: 'round', priority: 'High', name: `Refund is rounded (not truncated) to ${dp} decimal places`,
        objective: `Verify a refund with more than ${dp} decimals is rounded half-up to ${dp} decimal places.`,
        precondition: `Late cancellation fee of ${pct}% applies (booking with check-in 1 hour from now).`,
        steps: [`Create a booking (total ${money(total)}) with check-in 1 hour ahead`, 'Cancel the booking', 'Read refund from the response'],
        testData: `total=${money(total)}; fee=${pct}%; unrounded refund=${Number(raw.toFixed(6))}`,
        expected: `HTTP 200 and refund = ${expected.toFixed(dp)}`,
        code: () => `  const booking = await book(request, testInfo, ${total}, 1);
  const r = await call(request, testInfo, 'POST', \`/api/bookings/\${booking.id}/cancel\`);
  expect(r.status).toBe(200);
  expect(r.body.refund).toBe(${expected});`,
      }];
    },
  },
  {
    kind: 'confirmation-reference',
    title: 'Cancellation confirmation reference',
    match: /cancellation confirmation reference/i,
    params: () => ({}),
    cases: () => [{
      slot: 'ref', priority: 'Medium', name: 'Successful cancellation returns a confirmation reference',
      objective: 'Verify every successful cancellation returns a non-empty confirmation reference.',
      precondition: 'A confirmed booking.',
      steps: ['Create a booking (total 90.00) with check-in 7 days ahead', 'Cancel the booking', 'Read confirmationRef from the response'],
      testData: 'total=90.00; checkIn=now+168h', expected: 'HTTP 200 and a non-empty confirmationRef string',
      code: () => `  const booking = await book(request, testInfo, 90, 24 * 7);
  const r = await call(request, testInfo, 'POST', \`/api/bookings/\${booking.id}/cancel\`);
  expect(r.status).toBe(200);
  expect(typeof r.body.confirmationRef).toBe('string');
  expect(r.body.confirmationRef.length).toBeGreaterThan(0);`,
    }],
  },
  {
    kind: 'already-cancelled-status',
    title: 'Double cancellation rejected',
    match: /already cancelled\b.*HTTP (\d{3})/i,
    params: (m) => ({ status: Number(m[1]) }),
    cases: ({ status }) => [{
      slot: 'twice', priority: 'Medium', name: `Cancelling an already cancelled booking returns HTTP ${status}`,
      objective: `Verify a second cancellation of the same booking is rejected with HTTP ${status}.`,
      precondition: 'A booking that has already been cancelled.',
      steps: ['Create a booking (total 75.00)', 'Cancel it', 'Cancel it again'],
      testData: 'total=75.00; checkIn=now+168h', expected: `Second cancel returns HTTP ${status}`,
      code: () => `  const booking = await book(request, testInfo, 75, 24 * 7);
  const first = await call(request, testInfo, 'POST', \`/api/bookings/\${booking.id}/cancel\`);
  expect(first.status).toBe(200);
  const second = await call(request, testInfo, 'POST', \`/api/bookings/\${booking.id}/cancel\`);
  expect(second.status).toBe(${status});`,
    }],
  },
  {
    kind: 'unknown-booking-status',
    title: 'Unknown booking rejected',
    match: /unknown booking\b.*HTTP (\d{3})/i,
    params: (m) => ({ status: Number(m[1]) }),
    cases: ({ status }) => [{
      slot: 'unknown', priority: 'Medium', name: `Unknown booking ID returns HTTP ${status}`,
      objective: `Verify look-up and cancellation of a non-existent booking return HTTP ${status}.`,
      precondition: 'Booking ID BK-UNKNOWN-0000 does not exist.',
      steps: ['GET /api/bookings/BK-UNKNOWN-0000', 'POST /api/bookings/BK-UNKNOWN-0000/cancel'],
      testData: 'id=BK-UNKNOWN-0000', expected: `Both calls return HTTP ${status}`,
      code: () => `  const lookup = await call(request, testInfo, 'GET', '/api/bookings/BK-UNKNOWN-0000');
  expect(lookup.status).toBe(${status});
  const cancel = await call(request, testInfo, 'POST', '/api/bookings/BK-UNKNOWN-0000/cancel');
  expect(cancel.status).toBe(${status});`,
    }],
  },
  {
    kind: 'past-date-status',
    title: 'Past check-in date rejected',
    match: /past date\b.*HTTP (\d{3})/i,
    params: (m) => ({ status: Number(m[1]) }),
    cases: ({ status }) => [{
      slot: 'past', priority: 'Medium', name: `Changing check-in to a past date returns HTTP ${status}`,
      objective: `Verify a date change to a past check-in date is rejected with HTTP ${status}.`,
      precondition: 'A confirmed booking with check-in 10 days from now.',
      steps: ['Create a booking (total 120.00) with check-in 10 days ahead', 'PATCH the booking with a check-in 24 hours in the past'],
      testData: 'total=120.00; new checkIn=now-24h', expected: `HTTP ${status}`,
      code: () => `  const booking = await book(request, testInfo, 120, 24 * 10);
  const r = await call(request, testInfo, 'PATCH', \`/api/bookings/\${booking.id}\`, { checkIn: inHours(-24) });
  expect(r.status).toBe(${status});`,
    }],
  },
  {
    kind: 'api-latency',
    title: 'API response time',
    type: 'non-functional',
    match: /within (\d+)\s*ms\b/i,
    params: (m, values) => ({ ms: Number(m[1]), percentile: values.find((v) => v.unit === 'percentile')?.num ?? 95 }),
    cases: ({ ms, percentile }) => [{
      slot: 'p', priority: 'Medium', name: `Booking look-up p${percentile} response time is within ${ms} ms`,
      objective: `Verify the ${percentile}th percentile of 20 booking look-ups is at most ${ms} ms.`,
      precondition: 'A confirmed booking exists.',
      steps: ['Create a booking', 'Call GET /api/bookings/{id} 20 times, timing each call', `Compute the p${percentile} latency`],
      testData: 'samples=20', expected: `p${percentile} <= ${ms} ms`,
      code: () => `  const booking = await book(request, testInfo, 100, 24 * 7);
  const samples = [];
  for (let i = 0; i < 20; i += 1) {
    const t0 = Date.now();
    const res = await request.get(\`/api/bookings/\${booking.id}\`);
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
    kind: 'online-cancellation-ui',
    title: 'Online cancellation (UI)',
    match: /cancel a booking online/i,
    params: () => ({}),
    ui: true,
    cases: () => [{
      slot: 'ui', priority: 'High', name: 'Guest cancels a booking on the Manage booking page',
      objective: 'Verify a guest can cancel a booking online end to end in the browser.',
      precondition: 'A confirmed booking exists; the Manage booking page is reachable.',
      steps: ['Open the Manage booking page', 'Enter the booking reference and click "Look up"', 'Click "Cancel booking"', 'Read the status message'],
      testData: 'total=160.00; checkIn=now+168h', expected: 'Page shows "Cancelled" with a confirmation reference',
      code: () => `  const booking = await book(request, testInfo, 160, 24 * 7);
  await page.goto('/');
  await page.fill('#booking-id', booking.id);
  await page.click('#lookup');
  await expect(page.locator('#result')).toContainText('confirmed');
  await page.click('#cancel');
  await expect(page.locator('#result')).toContainText('Cancelled');
  await expect(page.locator('#result')).toContainText('Confirmation reference');
  await testInfo.attach('screenshot', { body: await page.screenshot(), contentType: 'image/png' });`,
    }],
  },
  {
    kind: 'online-date-change-ui',
    title: 'Online date change (UI)',
    match: /change the check-in date\b.*online/i,
    params: () => ({}),
    ui: true,
    cases: () => [{
      slot: 'ui', priority: 'High', name: 'Guest changes the check-in date on the Manage booking page',
      objective: 'Verify a guest can move the check-in date online end to end in the browser.',
      precondition: 'A confirmed booking with check-in 10 days from now.',
      steps: ['Open the Manage booking page', 'Enter the booking reference', 'Pick a new check-in date 14 days ahead', 'Click "Change date"'],
      testData: 'total=210.00; new checkIn=now+14d', expected: 'Page shows "Check-in date updated"',
      code: () => `  const booking = await book(request, testInfo, 210, 24 * 10);
  await page.goto('/');
  await page.fill('#booking-id', booking.id);
  const d = new Date(Date.now() + 14 * 24 * HOUR);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  await page.fill('#new-checkin', local);
  await page.click('#change-date');
  await expect(page.locator('#result')).toContainText('Check-in date updated');
  await testInfo.attach('screenshot', { body: await page.screenshot(), contentType: 'image/png' });`,
    }],
  },
];

function classify(text) {
  const { values } = extractValues(text);
  for (const entry of CATALOGUE) {
    const m = String(text).match(entry.match);
    if (m) return { entry, params: entry.params(m, values) };
  }
  return null;
}

module.exports = { CATALOGUE, classify, round, trunc };
