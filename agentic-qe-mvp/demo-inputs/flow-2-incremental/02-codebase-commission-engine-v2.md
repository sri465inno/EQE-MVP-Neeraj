# README.md
# Aurora commission engine

Calculates the commission Aurora Hotels pays travel advisors on each reservation. A reservation is described by
the reservation data dictionary (`data-dictionary/reservation-attributes.json`): 1000 attributes in 20 groups, of
which the ones flagged `commissionDriver` feed the calculation. Every request carries the full reservation.

This is a sample codebase for the Agentic QE Platform - MVP demo (branch `demo/commission-engine-v2`, release 2.0).

## Commission rules

- Base commission is 10% of commissionable room revenue.
- Commissionable room revenue excludes taxes, resort fees and ancillary charges.
- Reservations booked through the GDS channel earn an additional 1.5% channel uplift.
- Stays of 7 nights or more earn a long-stay bonus of 1.5%.
- Commission per reservation is capped at USD 750.
- Commission is rounded half-up to 2 decimal places.
- Reservations paid with loyalty points are not commissionable.
- Every reservation is described by a data dictionary of 1000 attributes.
- Every commission calculation is written to the commission audit ledger.
- Group reservations of 10 or more rooms are commissioned at a flat 8%.
- Negotiated corporate rates (rate plan CORP) are commissioned at a flat 5%.

## Service behaviour

- A reservation without an advisor IATA number returns HTTP 422.
- Unknown reservation IDs return HTTP 404.

## API

- `GET /api/data-dictionary` - the reservation model (1000 attributes)
- `POST /api/commission/quote` - body `{ "reservation": { "<attribute>": value, ... } }`, returns the commission breakdown
- `POST /api/reservations` - stores a reservation, returns its ID
- `GET /api/reservations/:id/commission` - commission breakdown for a stored reservation
- `GET /api/ledger` - commission audit ledger
- `GET /` - advisor commission statement page

## Run

```bash
npm install
npm start   # http://localhost:4200 (PORT to change)
```


# src/app.js
'use strict';
const path = require('path');
const express = require('express');
const { calculateCommission } = require('./commission');
const R = require('./rules');

const DICTIONARY = require(path.join(__dirname, '..', 'data-dictionary', 'reservation-attributes.json'));
const KNOWN = new Set(DICTIONARY.attributes.map((a) => a.name));

function validate(reservation) {
  if (!reservation || typeof reservation !== 'object' || Array.isArray(reservation)) return 'reservation (object of attribute name -> value) is required';
  const unknown = Object.keys(reservation).filter((k) => !KNOWN.has(k));
  if (unknown.length) return `Unknown reservation attributes: ${unknown.slice(0, 5).join(', ')}`;
  if (!reservation['advisor.iataNumber']) return 'advisor.iataNumber is required for commission';
  return null;
}

function createApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  const reservations = new Map();
  const ledger = [];
  let seq = 5000;

  const quote = (reservationId, reservation) => {
    const result = { reservationId, attributesReceived: Object.keys(reservation).length, attributesInModel: DICTIONARY.count, ...calculateCommission(reservation) };
    ledger.push({ at: new Date().toISOString(), reservationId, commission: result.commission, effectiveRatePct: result.effectiveRatePct, build: R.BUILD });
    return result;
  };

  app.get('/api/health', (req, res) => res.json({ ok: true, service: 'aurora-commission-engine', build: R.BUILD }));
  app.get('/api/data-dictionary', (req, res) => res.json(DICTIONARY));
  app.get('/api/ledger', (req, res) => res.json({ entries: ledger }));

  app.post('/api/commission/quote', (req, res) => {
    const reservation = (req.body || {}).reservation;
    const err = validate(reservation);
    if (err) return res.status(422).json({ error: err });
    res.json(quote(reservation['reservation.confirmationCode'] || null, reservation));
  });

  app.post('/api/reservations', (req, res) => {
    const reservation = (req.body || {}).reservation;
    const err = validate(reservation);
    if (err) return res.status(422).json({ error: err });
    seq += 1;
    const id = `RES-${seq}`;
    reservations.set(id, reservation);
    res.status(201).json({ id, attributesReceived: Object.keys(reservation).length });
  });

  app.get('/api/reservations/:id/commission', (req, res) => {
    const reservation = reservations.get(req.params.id);
    if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
    res.json(quote(req.params.id, reservation));
  });

  app.get('/', (req, res) => res.type('html').send(PAGE));
  return app;
}

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Aurora Hotels - Advisor commission statement</title>
<style>body{font-family:system-ui,sans-serif;max-width:680px;margin:2rem auto;color:#1d2433}input{padding:.4rem;width:220px}button{padding:.45rem .9rem;margin-left:.4rem}
#statement{margin-top:1rem;padding:.8rem;background:#f1f5fb;border-radius:6px}table{border-collapse:collapse;width:100%}td{padding:.25rem .4rem;border-bottom:1px solid #dde3ee}</style>
</head><body><h1>Aurora Hotels - Advisor commission statement</h1><p>Build: <code>${R.BUILD}</code></p>
<label for="reservation-id">Reservation ID</label> <input id="reservation-id" placeholder="RES-5001"><button id="show">Show commission</button>
<div id="statement" role="status" aria-live="polite">Enter a reservation ID.</div>
<script>
const $ = (id) => document.getElementById(id);
const money = (n) => 'USD ' + Number(n).toFixed(2);
$('show').onclick = async () => {
  const r = await fetch('/api/reservations/' + encodeURIComponent($('reservation-id').value) + '/commission');
  const b = await r.json();
  if (r.status !== 200) { $('statement').textContent = b.error; return; }
  $('statement').innerHTML = '<h2>Commission breakdown for ' + b.reservationId + '</h2><table>' +
    '<tr><td>Commissionable room revenue</td><td>' + money(b.commissionableRevenue) + '</td></tr>' +
    b.lines.map((l) => '<tr><td>' + l.label + ' (' + l.ratePct + '%)</td><td>' + money(l.amount) + '</td></tr>').join('') +
    (b.capped ? '<tr><td>Cap applied</td><td>' + money(b.capUsd) + '</td></tr>' : '') +
    '<tr><td><b>Total commission</b></td><td><b>' + money(b.commission) + '</b></td></tr></table>' + (b.eligible ? '' : '<p>' + b.reason + '</p>');
};
</script></body></html>`;

module.exports = { createApp, validate, DICTIONARY };


# src/commission.js
'use strict';
const R = require('./rules');

function roundHalfUp(x, dp = R.DECIMALS) {
  const f = 10 ** dp;
  return Math.round((x + Number.EPSILON) * f) / f;
}

const num = (res, key) => Number(res[key] || 0);

function commissionableRevenue(res) {
  return roundHalfUp(num(res, 'revenue.totalAmount') - num(res, 'revenue.taxAmount') - num(res, 'revenue.resortFeeAmount') - num(res, 'revenue.ancillaryAmount'));
}

function rateLines(res) {
  if (res['rate.planCategory'] === 'CORP') return [{ code: 'CORPORATE', label: 'Negotiated corporate rate', ratePct: R.CORPORATE_RATE_PCT }];
  if (num(res, 'room.roomCount') >= R.GROUP_MIN_ROOMS) return [{ code: 'GROUP', label: 'Group flat rate', ratePct: R.GROUP_FLAT_RATE_PCT }];
  const lines = [{ code: 'BASE', label: 'Base commission', ratePct: R.BASE_RATE_PCT }];
  if (res['channel.bookingChannel'] === 'GDS') lines.push({ code: 'GDS_UPLIFT', label: 'GDS channel uplift', ratePct: R.GDS_UPLIFT_PCT });
  // Intentional demo defect: the rule says "7 nights or more" but this checks strictly more than 7.
  if (num(res, 'stay.nights') > R.LONG_STAY_NIGHTS) lines.push({ code: 'LONG_STAY', label: 'Long-stay bonus', ratePct: R.LONG_STAY_BONUS_PCT });
  return lines;
}

function calculateCommission(res) {
  const revenue = commissionableRevenue(res);
  const basis = res['rate.planCategory'] === 'PKG' ? roundHalfUp((revenue * R.PACKAGE_ROOM_COMPONENT_PCT) / 100) : revenue;
  const head = { currency: 'USD', build: R.BUILD, commissionableRevenue: revenue, basis };
  const status = res['reservation.status'];
  if (R.NON_COMMISSIONABLE_STATUSES.includes(status)) {
    return { ...head, eligible: false, reason: `Reservation status ${status} is not commissionable`, lines: [], effectiveRatePct: 0, grossCommission: 0, capped: false, capUsd: R.CAP_USD, commission: 0 };
  }
  if (res['payment.loyaltyPointsRedemption'] === true) {
    return { ...head, eligible: false, reason: 'Paid with loyalty points - not commissionable', lines: [], effectiveRatePct: 0, grossCommission: 0, capped: false, capUsd: R.CAP_USD, commission: 0 };
  }
  const lines = rateLines(res).map((l) => ({ ...l, amount: roundHalfUp((basis * l.ratePct) / 100) }));
  const effectiveRatePct = lines.reduce((s, l) => s + l.ratePct, 0);
  const gross = (basis * effectiveRatePct) / 100;
  const capped = gross > R.CAP_USD;
  return { ...head, eligible: true, reason: null, lines, effectiveRatePct, grossCommission: roundHalfUp(gross), capped, capUsd: R.CAP_USD, commission: roundHalfUp(Math.min(gross, R.CAP_USD)) };
}

module.exports = { calculateCommission, commissionableRevenue, roundHalfUp };


# src/rules.js
'use strict';
// Commission parameters for release 2.0.

const BUILD = 'demo/commission-engine-v2';

/** @rule Base commission is 10% of commissionable room revenue. */
const BASE_RATE_PCT = 10;

/** @rule Reservations booked through the GDS channel earn an additional 1.5% channel uplift. */
const GDS_UPLIFT_PCT = 1.5;

/** @rule Stays of 7 nights or more earn a long-stay bonus of 1.5%. */
const LONG_STAY_NIGHTS = 7;
const LONG_STAY_BONUS_PCT = 1.5;

/** @rule Commission per reservation is capped at USD 750. */
const CAP_USD = 750;

/** @rule Commission is rounded half-up to 2 decimal places. */
const DECIMALS = 2;

/** @rule Group reservations of 10 or more rooms are commissioned at a flat 8%. */
const GROUP_MIN_ROOMS = 10;
const GROUP_FLAT_RATE_PCT = 8;

/** @rule Negotiated corporate rates (rate plan CORP) are commissioned at a flat 5%. */
const CORPORATE_RATE_PCT = 5;

// Package rates: commission is paid on the room component of the package price.
const PACKAGE_ROOM_COMPONENT_PCT = 70;

const NON_COMMISSIONABLE_STATUSES = ['CANCELLED', 'NO_SHOW'];

module.exports = { BUILD, BASE_RATE_PCT, GDS_UPLIFT_PCT, LONG_STAY_NIGHTS, LONG_STAY_BONUS_PCT, CAP_USD, DECIMALS,
  GROUP_MIN_ROOMS, GROUP_FLAT_RATE_PCT, CORPORATE_RATE_PCT, PACKAGE_ROOM_COMPONENT_PCT, NON_COMMISSIONABLE_STATUSES };


# src/server.js
'use strict';
const { createApp } = require('./app');
const R = require('./rules');

const port = Number(process.env.PORT || 4200);
createApp().listen(port, () => console.log(`Aurora commission engine (${R.BUILD}) on http://localhost:${port}`));
