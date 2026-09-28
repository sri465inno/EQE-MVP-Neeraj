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
