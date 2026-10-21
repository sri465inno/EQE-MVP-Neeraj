'use strict';
// Hospitality skill catalogue used by the rule-based agents:
//  - GLOSSARY: business terms used in requirements and the accessible names they may have in the UI (for black-box resolution)
//  - STAGES: the guest journey, in order
//  - TECHNIQUES: patterns that turn an acceptance criterion into a test technique
const GLOSSARY = {
  destination: { synonyms: ['destination', 'city', 'where'], kind: 'field' },
  'check-in date': { synonyms: ['check-in date', 'check-in', 'check in', 'arrival'], kind: 'field' },
  'check-out date': { synonyms: ['check-out date', 'check-out', 'check out', 'departure'], kind: 'field' },
  'number of guests': { synonyms: ['guests', 'number of guests', 'travellers'], kind: 'field', mention: /number of guests|\bguests\b/ },
  search: { synonyms: ['search', 'find hotels'], kind: 'action' },
  'search results': { synonyms: ['hotel results', 'search results', 'results'], kind: 'region' },
  'view details': { synonyms: ['view details', 'view hotel', 'see details'], kind: 'action' },
  reserve: { synonyms: ['reserve', 'book this room', 'select room'], kind: 'action' },
  'first name': { synonyms: ['first name', 'given name'], kind: 'field' },
  'last name': { synonyms: ['last name', 'surname', 'family name'], kind: 'field' },
  email: { synonyms: ['email', 'email address', 'e-mail'], kind: 'field', mention: /\bemail\b/ },
  phone: { synonyms: ['phone', 'phone number', 'mobile'], kind: 'field', mention: /\bphone\b/ },
  'confirm reservation': { synonyms: ['confirm reservation', 'confirm booking', 'book now', 'complete booking'], kind: 'action' },
  'confirmation number': { synonyms: ['confirmation number', 'booking reference', 'reservation number'], kind: 'field' },
  'find reservation': { synonyms: ['find reservation', 'find booking', 'manage booking'], kind: 'action' },
  'sort by': { synonyms: ['sort by', 'sort'], kind: 'field' },
  'minimum star rating': { synonyms: ['minimum stars', 'star rating', 'stars'], kind: 'field' },
  password: { synonyms: ['password'], kind: 'field' },
  'sign in': { synonyms: ['sign in', 'log in'], kind: 'action' },
  'sign out': { synonyms: ['sign out', 'log out'], kind: 'action' },
  'my account': { synonyms: ['my account'], kind: 'action' },
};
const FIELD_TERMS = ['destination', 'check-in date', 'check-out date', 'number of guests', 'first name', 'last name', 'email', 'phone', 'confirmation number'];
const mentions = (text) => FIELD_TERMS.filter((t) => (GLOSSARY[t].mention || new RegExp(t.replace(/[-]/g, '[- ]?'), 'i')).test(text.toLowerCase()));

const STAGES = [
  { id: 'member', label: 'Member sign in', match: /\bmembers?\b|sign in|sign out|\bpoints\b|my account/i },
  { id: 'search', label: 'Search hotels', match: /\bsearch\b/i },
  { id: 'results', label: 'Refine results', match: /\bsort\b|\bfilter\b/i },
  { id: 'hotel', label: 'View hotel', match: /hotel details|view hotel/i },
  { id: 'find', label: 'Find reservation', match: /\bfind\b|existing reservation|look ?up/i },
  { id: 'booking', label: 'Create reservation', match: /\bbook\b|reserv|guest details/i },
];
// 'account' runs after booking: My account, sign out and sign in again (member stories).
const JOURNEY_ORDER = ['search', 'hotel', 'booking', 'account', 'find'];
const storyStage = (summary, epic = '') => (STAGES.find((s) => s.match.test(summary)) || STAGES.find((s) => s.match.test(epic)) || { id: 'unknown' }).id;

const quoted = (t) => [...t.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const VAGUE = /\b(quickly|fast|user[- ]friendly|intuitive|appropriate|seamless(?:ly)?|easy|easily|responsive|promptly)\b/i;

// Ordered: the first matching technique wins.
const TECHNIQUES = [
  { id: 'not-observable', label: 'Not observable in the web UI', kind: 'manual', match: (t) => /\b(email|sms|notification)\b[^.]*\bis sent\b|\bis sent to\b/i.test(t) && {} ,
    reason: 'The outcome happens outside the web UI (email channel); verify manually or with a mailbox stub.' },
  { id: 'ambiguous', label: 'Ambiguous: no measurable outcome', kind: 'manual', match: (t) => VAGUE.test(t) && !/\d/.test(t) && { term: t.match(VAGUE)[1] },
    reason: 'Contains a vague term without a measurable threshold; ask the product owner for a number before automating.' },
  // Member login and loyalty. The journey signs in as the Gold demo member; other levels get their own case.
  { id: 'signin-required', label: 'Journey: sign in required to reserve', kind: 'journey', stage: 'booking', match: (t) => /not signed in/i.test(t) && /reserve/i.test(t) && {} },
  { id: 'signin-return', label: 'Journey: back to the reservation after sign in', kind: 'journey', stage: 'booking', match: (t) => /after signing in/i.test(t) && {} },
  { id: 'signin-invalid', label: 'Negative: wrong email or password', kind: 'variant', match: (t) => /email or password is wrong/i.test(t) && { password: 'wrong-password' } },
  { id: 'signin', label: 'Journey: member signs in', kind: 'journey', stage: 'booking', match: (t) => /email and password/i.test(t) && /select sign in/i.test(t) && {} },
  { id: 'account-retained', label: 'Journey: reservation kept after signing in again', kind: 'journey', stage: 'account', match: (t) => /signs out and signs in again/i.test(t) && {} },
  { id: 'signout', label: 'Journey: member signs out', kind: 'journey', stage: 'account', match: (t) => /selects sign out/i.test(t) && {} },
  { id: 'points-earned', label: 'Journey: points earned by level', kind: 'journey', stage: 'booking', match: (t) => /\bpoints\b/i.test(t) && /\bGold member\b/i.test(t) && quoted(t).length && { level: 'Gold' } },
  { id: 'points-level', label: 'Variant: points earned by member level', kind: 'variant', match: (t) => /\bpoints\b/i.test(t) && /\b(Platinum|Ambassador) member\b/i.test(t) && quoted(t).length && { level: t.match(/\b(Platinum|Ambassador) member\b/i)[1] } },
  { id: 'account-list', label: 'Journey: My reservations in the account', kind: 'journey', stage: 'account', match: (t) => /my reservations/i.test(t) && /my account/i.test(t) && {} },
  { id: 'date-order', label: 'Boundary: check-out not after check-in', kind: 'variant', match: (t) => /check-out date is not after the check-in date/i.test(t) && {} },
  { id: 'no-results', label: 'Negative: no matching hotels', kind: 'variant', match: (t) => /no hotels? match/i.test(t) && { destination: 'Atlantis' } },
  { id: 'invalid-email', label: 'Negative: invalid email format', kind: 'variant', match: (t) => /email address is not valid|invalid email/i.test(t) && { value: 'ava.thompson@example' } },
  { id: 'find-none', label: 'Negative: reservation not found', kind: 'variant', match: (t) => /no reservation matches/i.test(t) && { confirmationNumber: 'SE000000', lastName: 'Nobody' } },
  { id: 'case-insensitive', label: 'Variant: letter case ignored', kind: 'variant', match: (t) => /ignores letter case|case[- ]insensitive/i.test(t) && { field: mentions(t)[0] || 'last name' } },
  { id: 'required', label: 'Negative: mandatory field left empty', kind: 'variant', match: (t, ctx) => /left empty|are required|is required/i.test(t) && { fields: mentions(t.split(/left empty|are required|is required/i)[0]) } },
  { id: 'sort', label: 'Functional: sort results', kind: 'variant', match: (t) => /\bsort\b/i.test(t) && quoted(t).length && { option: quoted(t)[0], order: /descending|high to low/i.test(t) ? 'desc' : 'asc' } },
  { id: 'filter', label: 'Functional: filter results', kind: 'variant', match: (t) => /\bfilter\b/i.test(t) && quoted(t).length && /only (\S+) hotels/i.test(t) && { option: quoted(t)[0], each: t.match(/only (\S+) hotels/i)[1] } },
  { id: 'search-results', label: 'Journey: search returns hotels', kind: 'journey', stage: 'search', match: (t) => /search results list|results list the available hotels/i.test(t) && {} },
  { id: 'hotel-details', label: 'Journey: hotel details page', kind: 'journey', stage: 'hotel', match: (t) => /details page shows/i.test(t) && {} },
  { id: 'rooms-list', label: 'Journey: rooms with Reserve option', kind: 'journey', stage: 'hotel', match: (t) => /reserve option|lists the "?rooms/i.test(t) && {} },
  { id: 'booking-confirm', label: 'Journey: reservation confirmed', kind: 'journey', stage: 'booking', match: (t) => /confirmation number/i.test(t) && /confirm reservation/i.test(t) && {} },
  { id: 'booking-summary', label: 'Journey: booking summary', kind: 'journey', stage: 'booking', match: (t) => /booking summary/i.test(t) && {} },
  { id: 'find-positive', label: 'Journey: find reservation', kind: 'journey', stage: 'find', match: (t) => /enters the confirmation number and last name/i.test(t) && {} },
];

function classify(text, ctx) {
  for (const tq of TECHNIQUES) {
    const params = tq.match(text, ctx);
    if (params) return { technique: tq.id, label: tq.label, kind: tq.kind, stage: tq.stage || ctx.stage, params, reason: tq.reason };
  }
  return { technique: 'unmatched', label: 'No automation pattern', kind: 'manual', stage: ctx.stage, params: {}, reason: 'No pattern in the skill catalogue matches this criterion; design the test by hand or add a pattern.' };
}

// Test case level shown in Test case design. Labels can be renamed here.
const LEVELS = { agent: 'AI Generated', rules: 'Rule Generated', user: 'User Defined', automated: 'Automated' };
// The original level (AI Generated / User Defined) is kept; Automated is added once a working script exists.
const levelsOf = (run, t) => [t.origin === 'user' ? LEVELS.user : t.engine === 'devin' ? LEVELS.agent : LEVELS.rules, ...((run.scripts?.cases || []).some((c) => c.tcId === t.id && c.status === 'generated') ? [LEVELS.automated] : [])];
const levelOf = (run, t) => levelsOf(run, t).join(', ');

module.exports = { LEVELS, levelsOf, levelOf, GLOSSARY, FIELD_TERMS, STAGES, JOURNEY_ORDER, storyStage, quoted, mentions, VAGUE, TECHNIQUES, classify };
