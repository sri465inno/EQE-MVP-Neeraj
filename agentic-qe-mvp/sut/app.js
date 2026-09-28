'use strict';
// StayWell booking-service: the bundled system under test (SUT).
// Two builds mirror the two codebase fixtures:
//   main                         -> baseline cycle
//   feature/booking-date-changes -> incremental cycle (refund SLA 2 days, date changes)
const express = require('express');

const BUILDS = {
  main: { lateFeePct: 20, freeCancelHours: 48, refundDays: 3, dateChanges: false },
  'feature/booking-date-changes': {
    lateFeePct: 20, freeCancelHours: 48, refundDays: 2, dateChanges: true,
    freeChangeHours: 24, lateChangeFee: 25,
  },
};

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

// SEEDED DEFECT (intentional, the one genuine bug in the SUT):
// the README promises refunds "rounded to 2 decimal places" but money is truncated.
function toMoney(amount) {
  return Math.floor(amount * 100) / 100;
}

function roundMoney(amount) {
  return Math.round(amount * 100) / 100;
}

function createSutApp({ version = 'main' } = {}) {
  const cfg = BUILDS[version];
  if (!cfg) throw new Error(`Unknown SUT build "${version}"`);
  const app = express();
  app.use(express.json());
  const bookings = new Map();
  let seq = 1000;

  const hoursUntil = (iso) => (new Date(iso).getTime() - Date.now()) / HOUR;

  app.get('/api/health', (req, res) => res.json({ ok: true, service: 'staywell-booking-service', build: version }));

  app.post('/api/bookings', (req, res) => {
    const { guest = 'Guest', total, checkIn } = req.body || {};
    if (typeof total !== 'number' || total <= 0 || !checkIn || Number.isNaN(Date.parse(checkIn))) {
      return res.status(400).json({ error: 'total (number > 0) and checkIn (ISO date) are required' });
    }
    seq += 1;
    const booking = { id: `BK-${seq}`, guest, total, checkIn: new Date(checkIn).toISOString(), status: 'confirmed' };
    bookings.set(booking.id, booking);
    res.status(201).json(booking);
  });

  app.get('/api/bookings/:id', (req, res) => {
    const booking = bookings.get(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json(booking);
  });

  app.post('/api/bookings/:id/cancel', (req, res) => {
    const booking = bookings.get(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status === 'cancelled') return res.status(409).json({ error: 'Booking already cancelled' });
    const late = hoursUntil(booking.checkIn) < cfg.freeCancelHours;
    const fee = late ? roundMoney((booking.total * cfg.lateFeePct) / 100) : 0;
    const refund = toMoney(booking.total - (late ? (booking.total * cfg.lateFeePct) / 100 : 0));
    const cancelledAt = new Date();
    Object.assign(booking, {
      status: 'cancelled',
      fee,
      refund,
      cancelledAt: cancelledAt.toISOString(),
      refundDueBy: new Date(cancelledAt.getTime() + cfg.refundDays * DAY).toISOString(),
      confirmationRef: `CNX-${booking.id.slice(3)}-${cancelledAt.getTime().toString(36).toUpperCase()}`,
    });
    res.json(booking);
  });

  app.patch('/api/bookings/:id', (req, res) => {
    if (!cfg.dateChanges) return res.status(405).json({ error: 'Date changes are not supported in this build' });
    const booking = bookings.get(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    const { checkIn } = req.body || {};
    if (!checkIn || Number.isNaN(Date.parse(checkIn))) return res.status(400).json({ error: 'checkIn (ISO date) is required' });
    if (new Date(checkIn).getTime() < Date.now()) return res.status(422).json({ error: 'Check-in date cannot be in the past' });
    const changeFee = hoursUntil(booking.checkIn) >= cfg.freeChangeHours ? 0 : cfg.lateChangeFee;
    Object.assign(booking, { checkIn: new Date(checkIn).toISOString(), changeFee });
    res.json(booking);
  });

  app.get('/', (req, res) => res.type('html').send(page(version, cfg)));
  return app;
}

function page(version, cfg) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>StayWell - Manage booking</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:2rem auto;color:#1d2433}label{display:block;margin:.6rem 0 .2rem}
input{padding:.4rem;width:260px}button{margin:.6rem .4rem 0 0;padding:.45rem .9rem}#result{margin-top:1rem;padding:.8rem;background:#f1f5fb;border-radius:6px;white-space:pre-wrap}</style>
</head><body><h1>StayWell - Manage your booking</h1><p>Build: <code>${version}</code></p>
<label for="booking-id">Booking reference</label><input id="booking-id" placeholder="BK-1001">
<div><button id="lookup">Look up</button><button id="cancel">Cancel booking</button></div>
${cfg.dateChanges ? `<label for="new-checkin">New check-in date</label><input id="new-checkin" type="datetime-local"><div><button id="change-date">Change date</button></div>` : ''}
<div id="result" role="status" aria-live="polite">Enter a booking reference.</div>
<script>
const $ = (id) => document.getElementById(id);
const show = (t) => { $('result').textContent = t; };
async function call(method, url, body) {
  const r = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
}
$('lookup').onclick = async () => { const r = await call('GET', '/api/bookings/' + $('booking-id').value);
  show(r.status === 200 ? 'Booking ' + r.body.id + ' is ' + r.body.status + ' (check-in ' + r.body.checkIn + ')' : r.body.error); };
$('cancel').onclick = async () => { const r = await call('POST', '/api/bookings/' + $('booking-id').value + '/cancel');
  show(r.status === 200 ? 'Cancelled. Confirmation reference: ' + r.body.confirmationRef + '. Refund: ' + r.body.refund : r.body.error); };
if ($('change-date')) $('change-date').onclick = async () => { const v = $('new-checkin').value;
  const r = await call('PATCH', '/api/bookings/' + $('booking-id').value, { checkIn: v ? new Date(v).toISOString() : '' });
  show(r.status === 200 ? 'Check-in date updated to ' + r.body.checkIn + '. Change fee: ' + r.body.changeFee : r.body.error); };
</script></body></html>`;
}

module.exports = { createSutApp, BUILDS };
