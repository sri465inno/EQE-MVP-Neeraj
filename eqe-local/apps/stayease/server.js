'use strict';
// StayEase: synthetic hospitality web app used as the black-box system under test.
const path = require('path');
const fs = require('fs');
const express = require('express');
const HOTELS = require('./data');
// Demo loyalty members. Points per night booked depend on the member level.
const MEMBERS = [
  { id: 'M1001', firstName: 'Ava', lastName: 'Thompson', email: 'ava.thompson@example.com', password: 'gold2026', level: 'Gold' },
  { id: 'M1002', firstName: 'Liam', lastName: 'Carter', email: 'liam.carter@example.com', password: 'platinum2026', level: 'Platinum' },
  { id: 'M1003', firstName: 'Priya', lastName: 'Nair', email: 'priya.nair@example.com', password: 'ambassador2026', level: 'Ambassador' },
];
const POINTS_PER_NIGHT = { Gold: 500, Platinum: 750, Ambassador: 1000 };
const sessions = new Map();
const publicMember = (m) => ({ id: m.id, firstName: m.firstName, lastName: m.lastName, name: `${m.firstName} ${m.lastName}`, email: m.email, level: m.level, pointsPerNight: POINTS_PER_NIGHT[m.level] });
const memberOf = (req) => MEMBERS.find((m) => m.id === sessions.get(req.get('x-member-token') || ''));

const PORT = Number(process.env.PORT || 4100);
const RELEASE = process.env.STAYEASE_RELEASE || '1.0';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data', 'stayease');
const FILE = path.join(DATA_DIR, 'reservations.json');
const TAX_RATE = 0.12;
fs.mkdirSync(DATA_DIR, { recursive: true });

const load = () => (fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : []);
const save = (list) => fs.writeFileSync(FILE, JSON.stringify(list, null, 2));

const DAY = 86400000;
const today = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d; };
const parseDate = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? new Date(s + 'T00:00:00Z') : null);
const nightsBetween = (a, b) => Math.round((b - a) / DAY);

function validateStay(q) {
  const errors = {};
  const guests = Number(q.guests || 1);
  const checkIn = parseDate(q.checkIn), checkOut = parseDate(q.checkOut);
  if (!checkIn) errors.checkIn = 'Please select a check-in date';
  else if (checkIn < today()) errors.checkIn = 'Check-in date cannot be in the past';
  if (!checkOut) errors.checkOut = 'Please select a check-out date';
  else if (checkIn && checkOut <= checkIn) errors.checkOut = 'Check-out date must be after check-in date';
  else if (checkIn && nightsBetween(checkIn, checkOut) > 30) errors.checkOut = 'Stays are limited to 30 nights';
  if (!Number.isInteger(guests) || guests < 1 || guests > 8) errors.guests = 'Guests must be between 1 and 8';
  return { errors, guests, checkIn, checkOut, nights: checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0 };
}

const priced = (h, nights, guests) => {
  const rooms = h.rooms.filter((r) => r.maxGuests >= guests).map((r) => ({
    ...r, nights, subtotal: r.rate * nights, taxes: Math.round(r.rate * nights * TAX_RATE * 100) / 100,
    total: Math.round(r.rate * nights * (1 + TAX_RATE) * 100) / 100,
  }));
  return { ...h, rooms, fromRate: rooms.length ? Math.min(...rooms.map((r) => r.rate)) : null };
};

const app = express();
app.use(express.json());
app.get('/api/health', (req, res) => res.json({ ok: true, app: 'StayEase', release: RELEASE }));
app.get('/api/destinations', (req, res) => res.json([...new Set(HOTELS.map((h) => h.city))]));

app.get('/api/hotels', (req, res) => {
  const q = req.query;
  const v = validateStay(q);
  if (!String(q.destination || '').trim()) v.errors.destination = 'Please enter a destination';
  if (Object.keys(v.errors).length) return res.status(400).json({ errors: v.errors });
  const dest = String(q.destination).trim().toLowerCase();
  const minStars = Number(q.minStars || 0);
  let list = HOTELS.filter((h) => h.city.toLowerCase().includes(dest) || h.country.toLowerCase() === dest)
    .filter((h) => h.stars >= minStars)
    .map((h) => priced(h, v.nights, v.guests)).filter((h) => h.rooms.length);
  const sorters = {
    'price-asc': (a, b) => a.fromRate - b.fromRate,
    'price-desc': (a, b) => b.fromRate - a.fromRate,
    rating: (a, b) => b.rating - a.rating,
    recommended: (a, b) => b.stars * 2 + b.rating - (a.stars * 2 + a.rating),
  };
  list.sort(sorters[q.sort] || sorters.recommended);
  res.json({ nights: v.nights, guests: v.guests, hotels: list });
});

app.get('/api/hotels/:id', (req, res) => {
  const h = HOTELS.find((x) => x.id === req.params.id);
  if (!h) return res.status(404).json({ error: 'Hotel not found' });
  const v = validateStay(req.query);
  res.json({ ...priced(h, v.nights || 1, v.guests), nights: v.nights || 1, stayErrors: v.errors });
});

app.post('/api/login', (req, res) => {
  const b = req.body || {};
  const m = MEMBERS.find((x) => x.email === String(b.email || '').trim().toLowerCase() && x.password === String(b.password || ''));
  if (!m) return res.status(401).json({ error: 'Incorrect email or password' });
  const token = require('crypto').randomBytes(16).toString('hex');
  sessions.set(token, m.id);
  res.json({ token, member: publicMember(m) });
});
app.post('/api/logout', (req, res) => { sessions.delete(req.get('x-member-token') || ''); res.json({ ok: true }); });
app.get('/api/me', (req, res) => {
  const m = memberOf(req);
  if (!m) return res.status(401).json({ error: 'Please sign in' });
  const mine = load().filter((r) => r.memberId === m.id).reverse();
  res.json({ member: publicMember(m), points: mine.filter((r) => r.status === 'Confirmed').reduce((n, r) => n + (r.pointsEarned || 0), 0), reservations: mine });
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;
const newCode = () => 'SE' + Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, '7');

app.post('/api/reservations', (req, res) => {
  const m = memberOf(req);
  if (!m) return res.status(401).json({ errors: { auth: 'Please sign in to make a reservation' } });
  const b = req.body || {};
  const v = validateStay(b);
  const errors = { ...v.errors };
  for (const f of ['firstName', 'lastName', 'email', 'phone']) if (!String(b[f] || '').trim()) errors[f] = 'This field is required';
  if (!errors.email && !EMAIL.test(b.email)) errors.email = 'Please enter a valid email address';
  if (!errors.phone && !PHONE.test(b.phone)) errors.phone = 'Please enter a valid phone number';
  const h = HOTELS.find((x) => x.id === b.hotelId);
  const r = h && h.rooms.find((x) => x.id === b.roomId);
  if (!r) errors.room = 'Please select a room';
  else if (r.maxGuests < v.guests) errors.guests = `This room sleeps up to ${r.maxGuests} guests`;
  if (Object.keys(errors).length) return res.status(400).json({ errors });
  const p = priced(h, v.nights, v.guests).rooms.find((x) => x.id === r.id);
  const reservation = {
    confirmationNumber: newCode(), status: 'Confirmed', createdAt: new Date().toISOString(),
    hotelId: h.id, hotelName: h.name, city: h.city, roomId: r.id, roomName: r.name,
    checkIn: b.checkIn, checkOut: b.checkOut, nights: v.nights, guests: v.guests,
    firstName: b.firstName.trim(), lastName: b.lastName.trim(), email: b.email.trim(), phone: b.phone.trim(),
    rate: r.rate, subtotal: p.subtotal, taxes: p.taxes, total: p.total,
    memberId: m.id, memberLevel: m.level, pointsEarned: POINTS_PER_NIGHT[m.level] * v.nights,
  };
  const list = load(); list.push(reservation); save(list);
  res.status(201).json(reservation);
});

app.get('/api/reservations/lookup', (req, res) => {
  // Release 1.0 matches the confirmation number exactly as typed; release 1.1 ignores letter case.
  const code = RELEASE === '1.0' ? String(req.query.confirmationNumber || '').trim() : String(req.query.confirmationNumber || '').trim().toUpperCase();
  const last = String(req.query.lastName || '').trim();
  if (!code || !last) return res.status(400).json({ error: 'Please enter your confirmation number and last name' });
  // Release 1.0 compares the last name exactly; release 1.1 ignores letter case.
  const same = RELEASE === '1.0' ? (a, b) => a === b : (a, b) => a.toLowerCase() === b.toLowerCase();
  const r = load().find((x) => x.confirmationNumber === code && same(x.lastName, last));
  if (!r) return res.status(404).json({ error: 'We could not find a reservation with those details' });
  res.json(r);
});

app.post('/api/reservations/:code/cancel', (req, res) => {
  const list = load();
  const r = list.find((x) => x.confirmationNumber === req.params.code);
  if (!r) return res.status(404).json({ error: 'Reservation not found' });
  r.status = 'Cancelled'; r.cancelledAt = new Date().toISOString(); save(list);
  res.json(r);
});

app.use(express.static(path.join(__dirname, 'public')));
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`StayEase ${RELEASE} on http://localhost:${PORT}`));
