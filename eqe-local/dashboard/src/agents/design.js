'use strict';
// E2E test design agent: builds end-to-end test cases from the analysed acceptance criteria.
// Positive criteria are chained into one guest journey (search → hotel → booking → find);
// negative and variant criteria get their own end-to-end case that starts from the home page.
const { JOURNEY_ORDER, LEVELS } = require('../catalog');

// Defaults, used only when a story has no "Test data" section in Jira for that value.
const DEFAULT_MEMBERS = {
  Gold: { firstName: 'Ava', lastName: 'Thompson', email: 'ava.thompson@example.com', phone: '+1 415 555 0134', password: 'gold2026' },
  Platinum: { firstName: 'Liam', lastName: 'Carter', email: 'liam.carter@example.com', phone: '+1 415 555 0177', password: 'platinum2026' },
  Ambassador: { firstName: 'Priya', lastName: 'Nair', email: 'priya.nair@example.com', phone: '+1 415 555 0190', password: 'ambassador2026' },
};
const DEFAULT_DATA = { destination: 'Paris', checkIn: 21, nights: 3, guests: '2', guest: { firstName: 'Ava', lastName: 'Thompson', email: 'ava.thompson@example.com', phone: '+1 415 555 0134' }, members: DEFAULT_MEMBERS,
  noHotels: 'Atlantis', invalidEmail: 'ava.thompson@example', unknownConfirmation: 'SE000000', unknownLastName: 'Nobody', wrongPassword: 'wrong-password' };
let DATA = DEFAULT_DATA; let MEMBERS = DEFAULT_MEMBERS;
const num = (v) => Number((String(v).match(/\d+/) || [])[0]);
const field = (name, get, set) => ({ name, get, set });
// Names accepted in a story's "Test data" section (case-insensitive), with where each value goes.
const TD_FIELDS = [
  field('Destination', (d) => d.destination, (d, v) => { d.destination = v; }),
  field('Check-in', (d) => `today + ${d.checkIn} days`, (d, v) => { d.checkIn = num(v); }),
  field('Nights', (d) => String(d.nights), (d, v) => { d.nights = num(v); }),
  field('Guests', (d) => d.guests, (d, v) => { d.guests = String(num(v)); }),
  field('Destination with no hotels', (d) => d.noHotels, (d, v) => { d.noHotels = v; }),
  ...[['first name', 'firstName'], ['last name', 'lastName'], ['email', 'email'], ['phone', 'phone']].map(([n, k]) => field(`Guest ${n}`, (d) => d.guest[k], (d, v) => { d.guest[k] = v; })),
  field('Invalid email', (d) => d.invalidEmail, (d, v) => { d.invalidEmail = v; }),
  field('Unknown confirmation number', (d) => d.unknownConfirmation, (d, v) => { d.unknownConfirmation = v; }),
  field('Unknown last name', (d) => d.unknownLastName, (d, v) => { d.unknownLastName = v; }),
  field('Wrong password', (d) => d.wrongPassword, (d, v) => { d.wrongPassword = v; }),
  ...['Gold', 'Platinum', 'Ambassador'].flatMap((l) => ['email', 'password'].map((k) => field(`${l} member ${k}`, (d) => d.members[l][k], (d, v) => { d.members[l][k] = v; }))),
];
function testDataFromJira(stories) {
  const d = JSON.parse(JSON.stringify(DEFAULT_DATA)); const from = {}; const unknown = [];
  for (const s of stories) for (const [name, value] of Object.entries(s.testData || {})) {
    const f = TD_FIELDS.find((x) => x.name.toLowerCase() === name.toLowerCase().trim());
    if (!f) { unknown.push(`${s.key}: ${name}`); continue; }
    f.set(d, value); from[f.name] = s.key;
  }
  return { d, from, unknown, table: TD_FIELDS.filter((f) => !NEGATIVE_DATA.includes(f.name)).map((f) => ({ name: f.name, value: f.get(d), story: from[f.name] || null })) };
}
const SIGNIN = ['signin-required', 'signin', 'signin-return'];
// EQE designs positive flows only: negative criteria are recorded as out of scope, not turned into test cases.
const NEGATIVE = ['date-order', 'no-results', 'invalid-email', 'find-none', 'required', 'signin-invalid'];
const NEGATIVE_DATA = ['Destination with no hotels', 'Invalid email', 'Unknown confirmation number', 'Unknown last name', 'Wrong password'];
const isNegative = (a) => a.kind === 'variant' && NEGATIVE.includes(a.technique);
const date = (n) => `{{date:+${n}}}`;
const showVal = (v) => (/^\{\{date:\+(\d+)\}\}$/.test(v) ? `today + ${v.match(/\d+/)[0]} days` : /^\$\{(\w+)\}$/.test(v) ? `<${v.slice(2, -1)} captured earlier>` : v);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Business-readable wording for checks, chosen by the text being checked; anything else reads as a message shown to the guest.
const heading = (t) => `The "${t}" heading is shown`; const section = (t) => `The "${t}" section is shown`; const message = (t) => `The message "${t}" is shown`;
const SAY = [
  [/^Search results$/i, 'Check that the search results page opens', heading],
  [/^Amenities$/i, 'Check the hotel details page', section],
  [/^Rooms$/i, 'Check the list of rooms on the hotel page', section],
  [/sign in to make a reservation/i, 'Check that the guest is asked to sign in before reserving', message],
  [/^Signed in as$/i, 'Check the page header after signing in', () => '"Signed in as" with the member\'s name and level is shown'],
  [/^Complete your reservation$/i, 'Check that the guest is back on the reservation form', heading],
  [/^Reservation confirmed$/i, 'Check that the reservation is confirmed', heading],
  [/^Your stay is booked$/i, 'Check the confirmation message', message],
  [/^Booking summary$/i, 'Check the booking summary', section],
  [/^\d+ nights?$/i, 'Check the length of stay in the booking summary', (t) => `The stay shows "${t}"`],
  [/^Total paid$/i, 'Check the amount paid in the booking summary', (t) => `"${t}" is shown with the amount`],
  [/^You earned/i, 'Check the loyalty points earned for this booking', (t) => `"${t}" is shown`],
  [/^My account$/i, 'Check that the My account page opens', heading],
  [/^My reservations$/i, 'Check the member\'s list of reservations', section],
  [/^Points balance$/i, 'Check the member\'s points balance', (t) => `The "${t}" is shown`],
  [/^\$\{confirmationNumber\}$/, 'Check that the new reservation is listed', () => 'The confirmation number noted earlier is shown'],
  [/^You have been signed out$/i, 'Check that the member is signed out', message],
  [/^Reservation details$/i, 'Check that the reservation is found', section],
  [/^(Confirmed|Cancelled)$/i, 'Check the reservation status', (t) => `The status "${t}" is shown`],
];
// Recomputes the action / expected wording of a step from its kind; used at design time and to refresh stored cycles.
function describeStep(st) {
  const L = cap(st.target || '');
  switch (st.kind) {
    case 'expectText': { const hit = SAY.find(([re]) => re.test(st.text)); return { action: hit ? hit[1] : 'Check the message shown to the guest', expected: (hit ? hit[2] : message)(st.text) }; }
    case 'click': return { action: `Click the "${L}" ${st.role === 'link' ? 'link' : 'button'}` };
    case 'capture': return { action: `Note the ${st.target} shown on the page`, expected: `A ${st.target} is shown` };
    case 'expectVisibleFirst': return { action: 'Check the list of rooms on the hotel page', expected: st.expected };
    case 'expectSorted': return { action: `Check the nightly prices in the ${st.target}`, expected: st.expected };
    case 'expectEach': return { action: `Check every hotel in the ${st.target}`, expected: st.expected };
    default: return { action: st.action, expected: st.expected };
  }
}
const said = (st) => Object.assign(st, describeStep(st));

const S = {
  goto: (path, action) => ({ kind: 'goto', path, action }),
  fill: (target, value) => ({ kind: 'fill', target, value, action: value === '' ? `Leave ${cap(target)} empty` : `Enter "${showVal(value)}" in ${cap(target)}` }),
  select: (target, value) => ({ kind: 'select', target, value, action: `Choose "${value}" in ${cap(target)}` }),
  click: (target, role = 'button') => said({ kind: 'click', target, role }),
  clickFirst: (target, role, action) => ({ kind: 'clickFirst', target, role, action }),
  text: (text) => said({ kind: 'expectText', text }),
  visibleFirst: (target, role, expected) => said({ kind: 'expectVisibleFirst', target, role, expected }),
  capture: (target, as) => said({ kind: 'capture', target, as }),
  sorted: (target, order) => said({ kind: 'expectSorted', target, order, expected: `Prices are in ${order === 'asc' ? 'ascending' : 'descending'} order` }),
  each: (target, text) => said({ kind: 'expectEach', target, text, expected: `Every hotel shows "${text}"` }),
};

// Journey building blocks.
const B = {
  search: (o = {}) => {
    const d = { ...DATA, ...o };
    return [S.goto('/', 'Open the StayEase home page'), S.fill('destination', d.destination), S.fill('check-in date', date(d.checkIn)),
      S.fill('check-out date', date(d.checkOut ?? d.checkIn + d.nights)), S.select('number of guests', d.guests), S.click('search')];
  },
  hotel: () => [S.clickFirst('view details', 'link', 'Select View details on the first hotel in the results')],
  signIn: (m = MEMBERS.Gold, password = m.password) => [S.fill('email', m.email), S.fill('password', password), S.click('sign in')],
  // Reserve requires a signed-in member: the guest is sent to Sign in and then back to the reservation form.
  booking: (g = {}, submit = true, o = {}) => {
    const m = o.member || MEMBERS.Gold;
    const v = { ...DATA.guest, ...(o.member ? { firstName: m.firstName, lastName: m.lastName, email: m.email, phone: m.phone } : {}), ...g };
    return [S.clickFirst('reserve', 'button', 'Select Reserve on the first room'), ...(o.afterReserve || []), ...B.signIn(m), ...(o.afterSignIn || []),
      S.fill('first name', v.firstName), S.fill('last name', v.lastName), S.fill('email', v.email), S.fill('phone', v.phone),
      ...(submit ? [S.click('confirm reservation')] : [])];
  },
  find: (conf, last) => [S.click('find reservation', 'link'), S.fill('confirmation number', conf), S.fill('last name', last), S.click('find reservation', 'button')],
};

// Assertions contributed by journey criteria at their stage.
function journeyChecks(ac) {
  const q = ac.messages.map(S.text);
  switch (ac.technique) {
    case 'search-results': return [S.text('Search results'), S.each('search results', DATA.destination)];
    case 'rooms-list': return [...q, S.visibleFirst('reserve', 'button', 'Each room offers a Reserve option')];
    case 'booking-confirm': return [...q, S.capture('confirmation number', 'confirmationNumber')];
    case 'booking-summary': return [...q, S.text(`${DATA.nights} nights`)];
    case 'account-list': return [...q, S.text('${confirmationNumber}')];
    case 'account-retained': return [...q, S.text('${confirmationNumber}')];
    default: return q;
  }
}

async function design(run, { log }) {
  const td = testDataFromJira(run.requirements?.stories || []);
  DATA = td.d; MEMBERS = DATA.members;
  const stories = run.analysis.stories;
  const acs = stories.flatMap((s) => s.acs.map((a) => ({ ...a, priority: s.priority, storySummary: s.summary })));
  const cases = [];
  const prio = (list) => (list.some((a) => ['Highest', 'High'].includes(a.priority)) ? 'P1' : list.some((a) => a.priority === 'Medium') ? 'P2' : 'P3');
  const add = (tc) => { tc.id = `TC-${String(cases.length + 1).padStart(3, '0')}`; tc.storyKeys = [...new Set(tc.acs.map((a) => a.storyKey))]; tc.acIds = tc.acs.map((a) => a.id); tc.priority = tc.priority || prio(tc.acs); delete tc.acs; tc.steps.forEach((s, i) => { s.n = i + 1; }); tc.origin = 'agent'; tc.level = LEVELS.rules; cases.push(tc); };

  // 1. Main guest journey: chain stages up to the last stage that has a journey criterion.
  const journey = acs.filter((a) => a.kind === 'journey');
  if (journey.length) {
    const last = Math.max(...journey.map((a) => JOURNEY_ORDER.indexOf(a.stage)));
    const steps = [];
    const at = (st) => journey.filter((a) => a.stage === st && !SIGNIN.includes(a.technique)).flatMap(journeyChecks);
    const chk = (tech) => journey.filter((a) => a.technique === tech).flatMap(journeyChecks);
    const has = (tech) => journey.some((a) => a.technique === tech);
    JOURNEY_ORDER.slice(0, last + 1).forEach((st) => {
      if (st === 'search') steps.push(...B.search(), ...at('search'));
      if (st === 'hotel') steps.push(...B.hotel(), ...at('hotel'));
      if (st === 'booking') {
        steps.push(...B.booking({}, true, { afterReserve: chk('signin-required'), afterSignIn: [...chk('signin'), ...chk('signin-return')] }), ...at('booking'));
        if (last > JOURNEY_ORDER.indexOf('booking') && !steps.some((s) => s.kind === 'capture')) steps.push(S.capture('confirmation number', 'confirmationNumber'));
      }
      if (st === 'account') {
        if (has('account-list')) steps.push(S.click('my account', 'link'), ...chk('account-list'));
        if (has('signout') || has('account-retained')) steps.push(S.click('sign out'), ...chk('signout'));
        if (has('account-retained')) steps.push(...B.signIn(), S.click('my account', 'link'), ...chk('account-retained'));
      }
      if (st === 'find') steps.push(...B.find('${confirmationNumber}', DATA.guest.lastName), ...at('find'));
    });
    const booked = last >= JOURNEY_ORDER.indexOf('booking');
    const title = `Guest searches, views a hotel${booked ? ', signs in, books a room' : ''}${last >= JOURNEY_ORDER.indexOf('account') ? ', checks My account' : ''}${last >= JOURNEY_ORDER.indexOf('find') ? ' and finds the reservation' : ''}`;
    add({ title, type: 'E2E journey', automation: 'Automation', technique: 'journey', acs: journey, steps,
      preconditions: `StayEase is reachable; hotels exist in Paris${booked ? '; demo member Ava Thompson (Gold) can sign in' : ''}`, data: { destination: DATA.destination, stay: `${DATA.nights} nights from today + ${DATA.checkIn} days`, guests: DATA.guests, guest: DATA.guest, ...(booked ? { member: `${MEMBERS.Gold.email} (Gold)` } : {}) } });
    log(`Journey case covers ${journey.length} criteria across ${JOURNEY_ORDER.slice(0, last + 1).join(' → ')}`);
  }

  // 2. Variants and negatives.
  for (const a of acs.filter((x) => x.kind === 'variant' && !isNegative(x))) {
    const msg = a.messages[0];
    const base = { type: 'Variant', automation: 'Automation', technique: a.technique, acs: [a], preconditions: 'StayEase is reachable' };
    switch (a.technique) {
      case 'date-order':
        add({ ...base, title: 'Search is rejected when check-out is not after check-in', steps: [...B.search({ checkOut: DATA.checkIn }), S.text(msg)], data: { checkIn: 'today + 21 days', checkOut: 'same day' } }); break;
      case 'no-results':
        add({ ...base, title: 'Search for a destination with no hotels shows no results', steps: [...B.search({ destination: DATA.noHotels }), S.text(msg)], data: { destination: DATA.noHotels } }); break;
      case 'invalid-email':
        add({ ...base, title: 'Reservation is rejected for an invalid email address', steps: [...B.search(), ...B.hotel(), ...B.booking({ email: DATA.invalidEmail }), S.text(msg)], data: { email: DATA.invalidEmail } }); break;
      case 'signin-invalid':
        add({ ...base, title: 'Sign in is rejected for a wrong password', steps: [S.goto('/', 'Open the StayEase home page'), S.click('sign in', 'link'), ...B.signIn(MEMBERS.Gold, DATA.wrongPassword), S.text(msg)], data: { email: MEMBERS.Gold.email, password: DATA.wrongPassword } }); break;
      case 'points-level': {
        const m = MEMBERS[a.params.level];
        add({ ...base, type: 'Variant', title: `${a.params.level} member earns points for a reservation`, steps: [...B.search(), ...B.hotel(), ...B.booking({}, true, { member: m }), ...a.messages.map(S.text)], data: { member: `${m.email} (${a.params.level})`, nights: DATA.nights } });
        break;
      }
      case 'find-none':
        add({ ...base, title: 'Find reservation with unknown details shows not found', steps: [S.goto('/', 'Open the StayEase home page'), ...B.find(DATA.unknownConfirmation, DATA.unknownLastName), S.text(msg)], data: { confirmationNumber: DATA.unknownConfirmation, lastName: DATA.unknownLastName } }); break;
      case 'case-insensitive': {
        const positive = acs.find((x) => x.storyKey === a.storyKey && x.technique === 'find-positive');
        const expect = positive ? positive.messages : ['Reservation details'];
        if (/confirmation/i.test(a.params.field || '')) { add({ ...base, type: 'Variant', title: 'Find reservation with the confirmation number in lower case', steps: [...B.search(), ...B.hotel(), ...B.booking(), S.capture('confirmation number', 'confirmationNumber'), ...B.find('${confirmationNumber|lower}', DATA.guest.lastName), ...expect.map(S.text)], data: { confirmationNumber: '(the new confirmation number, in lower case)', lastName: DATA.guest.lastName } }); break; }
        add({ ...base, type: 'Variant', title: 'Find reservation with the last name in a different letter case', steps: [...B.search(), ...B.hotel(), ...B.booking(), S.capture('confirmation number', 'confirmationNumber'), ...B.find('${confirmationNumber}', DATA.guest.lastName.toLowerCase()), ...expect.map(S.text)], data: { lastNameBooked: DATA.guest.lastName, lastNameEntered: DATA.guest.lastName.toLowerCase() } });
        break;
      }
      case 'required':
        for (const f of a.params.fields) {
          if (a.stage === 'search') add({ ...base, title: `Search is rejected when ${f} is empty`, steps: [...B.search({ [f === 'destination' ? 'destination' : f]: '' }), S.text(msg)], data: { [f]: '(empty)' } });
          else if (a.stage === 'booking') {
            const key = { 'first name': 'firstName', 'last name': 'lastName', email: 'email', phone: 'phone' }[f];
            add({ ...base, title: `Reservation is rejected when ${f} is empty`, steps: [...B.search(), ...B.hotel(), ...B.booking({ [key]: '' }), S.text(msg)], data: { [f]: '(empty)' } });
          } else add({ ...base, title: `${f} is mandatory`, automation: 'Manual', steps: [{ kind: 'manual', action: `Leave ${f} empty and submit`, expected: msg ? `"${msg}" is shown` : 'An error is shown' }], data: {} });
        }
        break;
      case 'sort':
        add({ ...base, type: 'Functional', title: `Search results sorted by "${a.params.option}"`, steps: [...B.search(), S.select('sort by', a.params.option), S.sorted('search results', a.params.order)], data: { sort: a.params.option } }); break;
      case 'filter':
        add({ ...base, type: 'Functional', title: `Search results filtered by "${a.params.option}"`, steps: [...B.search(), S.select('minimum star rating', a.params.option), S.each('search results', a.params.each)], data: { filter: a.params.option } }); break;
      default: break;
    }
  }

  // 3. Manual cases for criteria that cannot be automated through the UI.
  for (const a of acs.filter((x) => x.kind === 'manual')) {
    const steps = a.technique === 'not-observable'
      ? [{ kind: 'manual', action: 'Complete a reservation end to end with a mailbox you can read', expected: 'Reservation confirmed page is shown' }, { kind: 'manual', action: 'Open the guest mailbox', expected: 'A confirmation email with the confirmation number arrives' }]
      : [{ kind: 'manual', action: a.text, expected: a.technique === 'ambiguous' ? 'Blocked until the product owner gives a measurable threshold' : 'As described in the acceptance criterion' }];
    add({ title: `${a.storySummary}: ${a.label.toLowerCase()}`, type: 'Manual', automation: 'Manual', technique: a.technique, acs: [a], steps, preconditions: a.reason, data: {}, needsClarification: a.technique === 'ambiguous' });
  }

  const SEARCH_FIELDS = ['Destination', 'Check-in', 'Nights', 'Guests'];
  for (const c of cases) {
    const vals = new Set(c.steps.map((x) => x.value).filter((v) => v != null && v !== ''));
    const searches = c.steps.some((x) => x.target === 'check-in date');
    c.testDataFrom = [...new Set(td.table.filter((r) => r.story && (vals.has(r.value) || (searches && SEARCH_FIELDS.includes(r.name)))).map((r) => r.story))];
  }
  const covered = new Set(cases.flatMap((c) => c.acIds));
  const inScope = acs.filter((a) => !isNegative(a));
  run.testCases = cases;
  run.design = {
    total: cases.length, automation: cases.filter((c) => c.automation === 'Automation').length, manual: cases.filter((c) => c.automation === 'Manual').length,
    acCovered: inScope.filter((a) => covered.has(a.id)).length, acTotal: inScope.length, acCoverage: Math.round((inScope.filter((a) => covered.has(a.id)).length / (inScope.length || 1)) * 1000) / 10,
    uncovered: inScope.filter((a) => !covered.has(a.id)).map((a) => a.id), outOfScope: acs.filter(isNegative).map((a) => a.id), testData: DATA, testDataTable: td.table,
  };
  const fromJira = td.table.filter((r) => r.story);
  log(`Test data: ${fromJira.length} value(s) from Jira (${[...new Set(fromJira.map((r) => r.story))].join(', ') || 'none'}); defaults used for ${td.table.length - fromJira.length}: ${td.table.filter((r) => !r.story).map((r) => r.name).join(', ') || 'none'}`, fromJira.length < td.table.length ? 'warn' : 'info');
  if (run.design.outOfScope.length) log(`Positive flows only: ${run.design.outOfScope.length} negative acceptance criteria out of scope (${run.design.outOfScope.join(', ')})`);
  if (td.unknown.length) log(`Test data names not recognised (ignored): ${td.unknown.join('; ')}`, 'warn');
  cases.forEach((c) => log(`${c.id} [${c.automation}] ${c.title} → ${c.acIds.join(', ')}`));
  log(`Traceability matrix generated: ${cases.length} test cases × ${new Set(cases.flatMap((c) => c.storyKeys)).size} stories, AC coverage ${run.design.acCoverage}%`);
  return `${cases.length} test cases (${run.design.automation} automatable, ${run.design.manual} manual) · AC coverage ${run.design.acCoverage}%`;
};
module.exports = design;
module.exports.describeStep = describeStep;
