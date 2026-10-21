'use strict';
const $app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const qs = () => Object.fromEntries(new URLSearchParams(location.search));
const toQs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')).toString();
const iso = (d) => d.toISOString().slice(0, 10);
const plusDays = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const fmtDate = (s) => new Date(s + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const member = () => JSON.parse(localStorage.getItem('se:member') || 'null');
const signOutLocal = () => { localStorage.removeItem('se:token'); localStorage.removeItem('se:member'); };
const api = async (url, opts = {}) => { const t = localStorage.getItem('se:token'); const r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), ...(t ? { 'x-member-token': t } : {}) } }); const body = await r.json().catch(() => ({})); return { ok: r.ok, status: r.status, body }; };
const go = (url) => { history.pushState({}, '', url); render(); };
const fieldErr = (id, msg) => (msg ? `<p class="err" role="alert" id="${id}-error">${esc(msg)}</p>` : '');
const field = (id, label, input, err) => `<div class="field"><label for="${id}">${label}</label>${input}${fieldErr(id, err)}</div>`;

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]');
  if (a && a.origin === location.origin) { e.preventDefault(); go(a.pathname + a.search); }
});
window.addEventListener('popstate', render);

function searchForm(v = {}, errors = {}) {
  const guests = Number(v.guests || 2);
  return `<form class="search" id="search-form" novalidate aria-label="Search hotels">
    ${field('destination', 'Destination', `<input id="destination" name="destination" list="dest-list" placeholder="City or country" value="${esc(v.destination || '')}" autocomplete="off">`, errors.destination)}
    ${field('checkIn', 'Check-in date', `<input id="checkIn" name="checkIn" type="date" value="${esc(v.checkIn || plusDays(14))}">`, errors.checkIn)}
    ${field('checkOut', 'Check-out date', `<input id="checkOut" name="checkOut" type="date" value="${esc(v.checkOut || plusDays(17))}">`, errors.checkOut)}
    ${field('guests', 'Guests', `<select id="guests" name="guests">${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<option value="${n}" ${n === guests ? 'selected' : ''}>${n}</option>`).join('')}</select>`, errors.guests)}
    <button type="submit">Search</button>
    <datalist id="dest-list"></datalist>
  </form>`;
}
function bindSearch(extra = {}) {
  fetch('/api/destinations').then((r) => r.json()).then((d) => { const l = document.getElementById('dest-list'); if (l) l.innerHTML = d.map((c) => `<option value="${esc(c)}">`).join(''); });
  document.getElementById('search-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = { ...Object.fromEntries(new FormData(e.target)), ...extra };
    const r = await api('/api/hotels?' + toQs(v));
    if (!r.ok) return renderHome(v, r.body.errors || {});
    go('/search?' + toQs(v));
  });
}

function renderHome(v = {}, errors = {}) {
  document.title = 'StayEase · Hotel booking';
  $app.innerHTML = `<section class="hero"><h1>Find your next stay</h1><p>Hand-picked hotels in the world's favourite cities.</p>${searchForm(v, errors)}</section>
  <h2 style="margin-top:32px">Popular destinations</h2>
  <div class="cities">${[['Paris', 'Boutique stays by the Seine'], ['London', 'Theatre-land and riverside views'], ['New York', 'Midtown to Brooklyn'], ['Tokyo', 'Ginza lights and onsen calm'], ['Goa', 'Beachfront resorts'], ['Find a booking', 'Look up an existing reservation']].map(([t, d]) => `<div class="city"><h3>${t}</h3><p class="muted">${d}</p></div>`).join('')}</div>`;
  bindSearch();
}

async function renderResults() {
  const q = qs();
  document.title = 'Search results · StayEase';
  const r = await api('/api/hotels?' + toQs(q));
  if (!r.ok) return renderHome(q, r.body.errors || {});
  const { hotels, nights } = r.body;
  const sortOpts = [['recommended', 'Recommended'], ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low'], ['rating', 'Guest rating']];
  const starOpts = [['', 'Any'], ['3', '3 stars and above'], ['4', '4 stars and above'], ['5', '5 stars only']];
  $app.innerHTML = `${searchForm(q)}
  <div class="toolbar">
    <div><h1 class="page">Search results</h1><p class="muted" id="result-count">${hotels.length} ${hotels.length === 1 ? 'hotel' : 'hotels'} in ${esc(q.destination)} · ${nights} ${nights === 1 ? 'night' : 'nights'} · ${esc(q.guests || 1)} guests</p></div>
    <div class="controls">
      ${field('sort', 'Sort by', `<select id="sort">${sortOpts.map(([v, l]) => `<option value="${v}" ${q.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
      ${field('minStars', 'Minimum stars', `<select id="minStars">${starOpts.map(([v, l]) => `<option value="${v}" ${(q.minStars || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
    </div>
  </div>
  ${hotels.length ? `<ul class="results" aria-label="Hotel results">${hotels.map((h) => `<li class="hotel">
      <div class="thumb" aria-hidden="true">${esc(h.name[0])}</div>
      <div><h3>${esc(h.name)}</h3>
        <div class="meta"><span class="stars">${h.stars}-star</span><span>Guest rating ${h.rating}</span><span>${esc(h.area)}, ${esc(h.city)}</span></div>
        <div>${h.amenities.slice(0, 3).map((a) => `<span class="pill">${esc(a)}</span>`).join('')}</div></div>
      <div class="price"><span class="muted">From</span><strong>${money(h.fromRate)}</strong><span class="muted">per night</span><br><br>
        <a class="btn" data-link href="/hotels/${h.id}?${toQs({ checkIn: q.checkIn, checkOut: q.checkOut, guests: q.guests })}">View details<span class="sr"> for ${esc(h.name)}</span></a></div>
    </li>`).join('')}</ul>` : `<div class="banner error" role="status">No hotels found for "${esc(q.destination)}". Try another destination.</div>`}`;
  bindSearch({ sort: q.sort, minStars: q.minStars });
  const reapply = () => go('/search?' + toQs({ ...q, sort: document.getElementById('sort').value, minStars: document.getElementById('minStars').value }));
  document.getElementById('sort').addEventListener('change', reapply);
  document.getElementById('minStars').addEventListener('change', reapply);
}

async function renderHotel(id) {
  const q = qs();
  const r = await api(`/api/hotels/${encodeURIComponent(id)}?` + toQs(q));
  if (!r.ok) { $app.innerHTML = `<div class="banner error" role="alert">Hotel not found</div>`; return; }
  const h = r.body;
  document.title = `${h.name} · StayEase`;
  $app.innerHTML = `<p><a href="javascript:history.back()">← Back to results</a></p>
  <h1 class="page">${esc(h.name)}</h1>
  <div class="meta"><span class="stars">${h.stars}-star</span><span>Guest rating ${h.rating}</span><span>${esc(h.area)}, ${esc(h.city)}, ${esc(h.country)}</span></div>
  <div class="cols" style="margin-top:20px">
    <section aria-labelledby="rooms-h"><h2 id="rooms-h">Rooms</h2>
      <p class="muted">${q.checkIn ? `${fmtDate(q.checkIn)} – ${fmtDate(q.checkOut)} · ` : ''}${h.nights} ${h.nights === 1 ? 'night' : 'nights'} · ${esc(q.guests || 1)} guests</p>
      ${h.rooms.length ? `<ul class="rooms">${h.rooms.map((rm) => `<li class="room"><div><h3>${esc(rm.name)}</h3>
        <div class="meta"><span>Sleeps up to ${rm.maxGuests}</span><span>${money(rm.rate)} per night</span></div>
        <div class="muted">Total ${money(rm.total)} for ${rm.nights} ${rm.nights === 1 ? 'night' : 'nights'} (incl. taxes)</div></div>
        <a class="btn" data-link href="/book?${toQs({ hotelId: h.id, roomId: rm.id, checkIn: q.checkIn, checkOut: q.checkOut, guests: q.guests })}" role="button">Reserve ${esc(rm.name)}</a></li>`).join('')}</ul>`
        : `<div class="banner error" role="status">No rooms for ${esc(q.guests)} guests</div>`}
    </section>
    <aside class="card" aria-labelledby="amen-h"><h2 id="amen-h">Amenities</h2><ul>${h.amenities.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></aside>
  </div>`;
}

async function renderBook(errors = {}, values = {}) {
  const q = qs();
  if (!member()) return go('/sign-in?' + toQs({ reason: 'book', next: location.pathname + location.search }));
  const r = await api(`/api/hotels/${encodeURIComponent(q.hotelId)}?` + toQs(q));
  if (!r.ok) { $app.innerHTML = `<div class="banner error" role="alert">Please select a room</div>`; return; }
  const h = r.body; const rm = h.rooms.find((x) => x.id === q.roomId) || h.rooms[0];
  document.title = 'Complete your reservation · StayEase';
  const f = (id, label, type) => field(id, label, `<input id="${id}" name="${id}" type="${type}" value="${esc(values[id] || '')}" autocomplete="off">`, errors[id]);
  const other = Object.entries(errors).filter(([k]) => !['firstName', 'lastName', 'email', 'phone'].includes(k));
  $app.innerHTML = `<h1 class="page">Complete your reservation</h1><p class="muted">You're almost there. We just need a few details.</p>
  ${other.length ? `<div class="banner error" role="alert">${other.map(([, m]) => esc(m)).join('<br>')}</div>` : ''}
  <div class="cols">
    <form class="card" id="guest-form" novalidate aria-label="Guest details"><h2>Guest details</h2>
      <div class="form">${f('firstName', 'First name', 'text')}${f('lastName', 'Last name', 'text')}${f('email', 'Email', 'email')}${f('phone', 'Phone', 'tel')}</div>
      <p><button type="submit">Confirm reservation</button></p>
    </form>
    <aside class="card" aria-labelledby="sum-h"><h2 id="sum-h">Booking summary</h2>
      <dl class="summary"><dt>Hotel</dt><dd>${esc(h.name)}</dd><dt>Room</dt><dd>${esc(rm.name)}</dd>
      <dt>Check-in</dt><dd>${esc(q.checkIn ? fmtDate(q.checkIn) : '-')}</dd><dt>Check-out</dt><dd>${esc(q.checkOut ? fmtDate(q.checkOut) : '-')}</dd>
      <dt>Stay</dt><dd>${h.nights} ${h.nights === 1 ? 'night' : 'nights'}</dd><dt>Guests</dt><dd>${esc(q.guests || 1)}</dd>
      <dt>Taxes (12%)</dt><dd>${money(rm.taxes)}</dd><dt>Total</dt><dd>${money(rm.total)}</dd></dl>
    </aside></div>`;
  document.getElementById('guest-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.target));
    const res = await api('/api/reservations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...q, ...v }) });
    if (res.status === 401) { signOutLocal(); return go('/sign-in?' + toQs({ reason: 'book', next: location.pathname + location.search })); }
    if (!res.ok) return renderBook(res.body.errors || {}, v);
    sessionStorage.setItem('se:last', JSON.stringify(res.body));
    go('/confirmation/' + res.body.confirmationNumber);
  });
}

function reservationCard(r, heading) {
  return `<section class="card" aria-labelledby="res-h"><h2 id="res-h">${heading}</h2>
    <dl class="summary"><dt>Status</dt><dd class="status-${esc(r.status)}">${esc(r.status)}</dd>
    <dt>Guest</dt><dd>${esc(r.firstName)} ${esc(r.lastName)}</dd><dt>Hotel</dt><dd>${esc(r.hotelName)}, ${esc(r.city)}</dd>
    <dt>Room</dt><dd>${esc(r.roomName)}</dd><dt>Check-in</dt><dd>${fmtDate(r.checkIn)}</dd><dt>Check-out</dt><dd>${fmtDate(r.checkOut)}</dd>
    <dt>Stay</dt><dd>${r.nights} ${r.nights === 1 ? 'night' : 'nights'}</dd><dt>Guests</dt><dd>${r.guests}</dd><dt>Total paid</dt><dd>${money(r.total)}</dd></dl></section>`;
}

function renderConfirmation(code) {
  const r = JSON.parse(sessionStorage.getItem('se:last') || 'null');
  document.title = 'Reservation confirmed · StayEase';
  if (!r || r.confirmationNumber !== code) { $app.innerHTML = `<h1 class="page">Reservation confirmed</h1><p>Confirmation number <output class="code" aria-label="Confirmation number">${esc(code)}</output></p>`; return; }
  $app.innerHTML = `<div class="banner ok" role="status">Thank you, ${esc(r.firstName)}. Your stay is booked.</div>
  <h1 class="page">Reservation confirmed</h1>
  <p>Confirmation number <output class="code" aria-label="Confirmation number">${esc(r.confirmationNumber)}</output></p>
  <p class="muted">A confirmation email has been sent to ${esc(r.email)}.</p>
  ${r.pointsEarned ? `<p class="points" role="status">You earned ${Number(r.pointsEarned).toLocaleString('en-US')} points as a ${esc(r.memberLevel)} member.</p>` : ''}
  ${reservationCard(r, 'Booking summary')}
  <p><a href="/find-reservation" data-link>Manage this reservation</a></p>`;
}

function renderFind(msg, r, v = {}) {
  document.title = 'Find your reservation · StayEase';
  $app.innerHTML = `<h1 class="page">Find your reservation</h1><p class="muted">Enter the confirmation number from your booking and the guest's last name.</p>
  <form class="card" id="find-form" novalidate aria-label="Find reservation" style="max-width:640px">
    <div class="form">${field('confirmationNumber', 'Confirmation number', `<input id="confirmationNumber" name="confirmationNumber" value="${esc(v.confirmationNumber || '')}" autocomplete="off">`)}
    ${field('lastName', 'Last name', `<input id="lastName" name="lastName" value="${esc(v.lastName || '')}" autocomplete="off">`)}</div>
    <p><button type="submit">Find reservation</button></p>
  </form>
  ${msg ? `<div class="banner error" role="alert">${esc(msg)}</div>` : ''}
  ${r ? reservationCard(r, 'Reservation details') + (r.status === 'Confirmed' ? `<p><button class="secondary" id="cancel-btn">Cancel reservation</button></p>` : '') : ''}`;
  document.getElementById('find-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fv = Object.fromEntries(new FormData(e.target));
    const res = await api('/api/reservations/lookup?' + toQs(fv));
    renderFind(res.ok ? null : res.body.error, res.ok ? res.body : null, fv);
  });
  const c = document.getElementById('cancel-btn');
  if (c) c.addEventListener('click', async () => {
    if (!confirm('Cancel this reservation?')) return;
    const res = await api(`/api/reservations/${r.confirmationNumber}/cancel`, { method: 'POST' });
    renderFind(null, res.body, v);
  });
}

function renderNav() {
  const m = member(); const el = document.getElementById('member-nav');
  el.innerHTML = m ? `<span class="who">Signed in as ${esc(m.name)} · ${esc(m.level)}</span><a href="/account" data-link>My account</a><button type="button" class="link" id="signout">Sign out</button>` : '<a href="/sign-in" data-link>Sign in</a>';
  const b = document.getElementById('signout');
  if (b) b.addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }); signOutLocal(); go('/sign-in?reason=out'); });
}

function renderSignIn(error, email = '') {
  const q = qs();
  document.title = 'Sign in · StayEase';
  $app.innerHTML = `<h1 class="page">Sign in</h1><p class="muted">Members sign in to book a stay and earn points on every night.</p>
  ${q.reason === 'book' ? '<div class="banner error" role="alert">Please sign in to make a reservation</div>' : ''}
  ${q.reason === 'out' ? '<div class="banner ok" role="status">You have been signed out</div>' : ''}
  ${error ? `<div class="banner error" role="alert">${esc(error)}</div>` : ''}
  <div class="cols"><form class="card" id="signin-form" novalidate aria-label="Sign in">
    <div class="form">${field('email', 'Email', `<input id="email" name="email" type="email" value="${esc(email)}" autocomplete="off">`)}
    ${field('password', 'Password', `<input id="password" name="password" type="password" autocomplete="off">`)}</div>
    <p><button type="submit">Sign in</button></p>
  </form>
  <aside class="card" aria-labelledby="demo-h"><h2 id="demo-h">Demo members</h2>
    <table class="levels"><thead><tr><th>Level</th><th>Member</th><th>Points per night</th></tr></thead><tbody>
    <tr><td>Gold</td><td>ava.thompson@example.com · gold2026</td><td>500</td></tr>
    <tr><td>Platinum</td><td>liam.carter@example.com · platinum2026</td><td>750</td></tr>
    <tr><td>Ambassador</td><td>priya.nair@example.com · ambassador2026</td><td>1,000</td></tr></tbody></table>
  </aside></div>`;
  document.getElementById('signin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.target));
    const res = await api('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(v) });
    if (!res.ok) return renderSignIn(res.body.error || 'Sign in failed', v.email);
    localStorage.setItem('se:token', res.body.token); localStorage.setItem('se:member', JSON.stringify(res.body.member));
    go(q.next && q.next.startsWith('/') ? q.next : '/account');
  });
}

async function renderAccount() {
  if (!member()) return go('/sign-in?' + toQs({ next: '/account' }));
  const r = await api('/api/me');
  if (r.status === 401) { signOutLocal(); return go('/sign-in?' + toQs({ next: '/account' })); }
  const { member: m, points, reservations } = r.body;
  document.title = 'My account · StayEase';
  $app.innerHTML = `<h1 class="page">My account</h1><p class="muted">${esc(m.name)} · ${esc(m.email)}</p>
  <div class="cols" style="grid-template-columns:1fr 1fr 1fr;margin:16px 0">
    <div class="card"><div class="muted">Member level</div><div class="big">${esc(m.level)}</div></div>
    <div class="card"><div class="muted">Points per night</div><div class="big">${m.pointsPerNight.toLocaleString('en-US')}</div></div>
    <div class="card"><div class="muted">Points balance</div><div class="big" aria-label="Points balance">${points.toLocaleString('en-US')}</div></div>
  </div>
  <section class="card" aria-labelledby="mine-h"><h2 id="mine-h">My reservations</h2>
  ${reservations.length ? `<table class="levels"><thead><tr><th>Confirmation number</th><th>Hotel</th><th>Room</th><th>Check-in</th><th>Nights</th><th>Status</th><th>Points</th></tr></thead><tbody>
    ${reservations.map((x) => `<tr><td class="mono">${esc(x.confirmationNumber)}</td><td>${esc(x.hotelName)}, ${esc(x.city)}</td><td>${esc(x.roomName)}</td><td>${fmtDate(x.checkIn)}</td><td>${x.nights}</td><td class="status-${esc(x.status)}">${esc(x.status)}</td><td>${Number(x.pointsEarned || 0).toLocaleString('en-US')}</td></tr>`).join('')}</tbody></table>`
    : '<p class="muted">You have no reservations yet.</p>'}</section>`;
}

function render() {
  renderNav();
  const p = location.pathname;
  let m;
  if (p === '/') renderHome();
  else if (p === '/search') renderResults();
  else if ((m = p.match(/^\/hotels\/([^/]+)$/))) renderHotel(decodeURIComponent(m[1]));
  else if (p === '/book') renderBook();
  else if ((m = p.match(/^\/confirmation\/([^/]+)$/))) renderConfirmation(m[1]);
  else if (p === '/find-reservation') renderFind();
  else if (p === '/sign-in') renderSignIn();
  else if (p === '/account') renderAccount();
  else $app.innerHTML = '<h1 class="page">Page not found</h1>';
  window.scrollTo(0, 0);
}
fetch('/api/health').then((r) => r.json()).then((h) => { document.getElementById('rel').textContent = 'Release ' + h.release; });
render();
