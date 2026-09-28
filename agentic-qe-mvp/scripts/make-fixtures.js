'use strict';
// Writes the sample input fixtures in the exact response shapes of
// Jira Cloud REST API v3 (GET /rest/api/3/issue/{key}, POST /rest/api/3/search/jql)
// and GitHub REST API (GET /repos/{o}/{r}, /branches/{b}, /readme, /contents/{path}, /compare/{base}...{head}).
// They are synthetic sample data in real API shapes, labelled "recorded fixture" in the app.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'fixtures');
const JIRA = 'https://staywell.atlassian.net';
const write = (rel, obj) => {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
};

const text = (t) => ({ type: 'text', text: t });
const para = (t) => ({ type: 'paragraph', content: [text(t)] });
const heading = (t, level = 3) => ({ type: 'heading', attrs: { level }, content: [text(t)] });
const bullets = (items) => ({ type: 'bulletList', content: items.map((i) => ({ type: 'listItem', content: [para(i)] })) });
const doc = (...content) => ({ type: 'doc', version: 1, content });

const project = { self: `${JIRA}/rest/api/3/project/10000`, id: '10000', key: 'SWB', name: 'StayWell Bookings', projectTypeKey: 'software', simplified: false };
const issueTypes = {
  Initiative: { id: '10527', name: 'Initiative', hierarchyLevel: 2, description: 'A large body of work spanning several epics.' },
  Epic: { id: '10000', name: 'Epic', hierarchyLevel: 1, description: 'A collection of related bugs, stories, and tasks.' },
  Story: { id: '10001', name: 'Story', hierarchyLevel: 0, description: 'Functionality or a feature expressed as a user goal.' },
};
const user = { self: `${JIRA}/rest/api/3/user?accountId=5b10ac8d82e05b22cc7d4ef5`, accountId: '5b10ac8d82e05b22cc7d4ef5', displayName: 'Priya Raman', active: true, timeZone: 'Europe/London', accountType: 'atlassian' };

function issue({ id, key, type, summary, description, parent, status = 'In Progress', priority = 'High', labels = [], created, updated }) {
  const it = issueTypes[type];
  return {
    expand: 'renderedFields,names,schema,operations,editmeta,changelog,versionedRepresentations',
    id, self: `${JIRA}/rest/api/3/issue/${id}`, key,
    fields: {
      summary,
      issuetype: { self: `${JIRA}/rest/api/3/issuetype/${it.id}`, id: it.id, description: it.description, iconUrl: `${JIRA}/images/icons/issuetypes/${type.toLowerCase()}.svg`, name: it.name, subtask: false, hierarchyLevel: it.hierarchyLevel },
      project,
      status: { self: `${JIRA}/rest/api/3/status/3`, name: status, id: '3', statusCategory: { self: `${JIRA}/rest/api/3/statuscategory/4`, id: 4, key: 'indeterminate', colorName: 'yellow', name: 'In Progress' } },
      priority: { self: `${JIRA}/rest/api/3/priority/2`, iconUrl: `${JIRA}/images/icons/priorities/high.svg`, name: priority, id: '2' },
      labels,
      reporter: user, assignee: user, creator: user,
      created, updated,
      ...(parent ? { parent: { id: parent.id, key: parent.key, self: `${JIRA}/rest/api/3/issue/${parent.id}`, fields: { summary: parent.summary, status: { name: 'In Progress' }, issuetype: { id: issueTypes[parent.type].id, name: parent.type, hierarchyLevel: issueTypes[parent.type].hierarchyLevel } } } } : {}),
      description,
    },
  };
}

const initiative = issue({
  id: '10100', key: 'SWB-1', type: 'Initiative', summary: 'Guest self-service booking management',
  labels: ['self-service', 'fy27'], created: '2026-07-06T09:12:44.000+0000', updated: '2026-09-02T14:03:11.000+0000',
  description: doc(
    para('Let guests manage their own bookings without contacting the hotel, reducing call-centre volume by 30%.'),
    heading('Outcomes'),
    bullets([
      'Guests can cancel a booking online without calling the hotel.',
      'Booking API responses return within 800 ms at the 95th percentile.',
    ]),
  ),
});
const parentRef = { id: '10100', key: 'SWB-1', summary: initiative.fields.summary, type: 'Initiative' };

const epic10 = issue({
  id: '10110', key: 'SWB-10', type: 'Epic', summary: 'Booking cancellation and refunds', parent: parentRef,
  labels: ['cancellation', 'payments'], created: '2026-07-13T10:20:00.000+0000', updated: '2026-09-08T08:45:31.000+0000',
  description: doc(
    para('Guests cancel from My Trips and receive their refund automatically.'),
    heading('Acceptance criteria'),
    bullets([
      'Cancellations made at least 48 hours before check-in are free of charge.',
      'Late cancellation fee is 15% of the booking total.',
      'Refunds are issued within 3 days of cancellation.',
      'Refund amounts are rounded to 2 decimal places.',
    ]),
  ),
});
const story11 = issue({
  id: '10111', key: 'SWB-11', type: 'Story', summary: 'Show cancellation confirmation', priority: 'Medium',
  parent: { id: '10110', key: 'SWB-10', summary: epic10.fields.summary, type: 'Epic' },
  labels: ['cancellation'], status: 'To Do', created: '2026-07-14T11:02:19.000+0000', updated: '2026-09-01T16:22:05.000+0000',
  description: doc(
    para('As a guest I want proof that my booking was cancelled.'),
    heading('Acceptance criteria'),
    bullets(['A cancellation confirmation reference is returned for every successful cancellation.']),
  ),
});
const epic20 = issue({
  id: '10120', key: 'SWB-20', type: 'Epic', summary: 'Self-service date changes', parent: parentRef,
  labels: ['date-change'], status: 'To Do', created: '2026-09-10T09:00:00.000+0000', updated: '2026-09-21T13:37:48.000+0000',
  description: doc(
    para('Guests move their stay to new dates without cancelling and rebooking.'),
    heading('Acceptance criteria'),
    bullets([
      'Guests can change the check-in date of a booking online.',
      'Date changes made at least 24 hours before check-in carry no fee.',
    ]),
  ),
});
const search = (issues) => ({ issues, isLast: true });

write('jira/SWB-1.json', initiative);
write('jira/SWB-10.json', epic10);
write('jira/SWB-10.children.json', search([story11]));
write('jira/SWB-11.json', story11);
write('jira/SWB-20.json', epic20);
write('jira/SWB-20.children.json', search([]));

// ---------- GitHub ----------
const OWNER = 'staywell';
const REPO = 'booking-service';
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/(.{60})/g, '$1\n') + '\n';
const repo = {
  id: 781230456, node_id: 'R_kgDOLpBxeA', name: REPO, full_name: `${OWNER}/${REPO}`, private: true,
  owner: { login: OWNER, id: 162030411, node_id: 'O_kgDOCaheSw', type: 'Organization', site_admin: false },
  html_url: `https://github.com/${OWNER}/${REPO}`, description: 'StayWell booking API: bookings, cancellations, refunds.',
  fork: false, url: API, created_at: '2026-03-02T10:11:12Z', updated_at: '2026-09-22T08:30:00Z', pushed_at: '2026-09-22T08:29:41Z',
  language: 'JavaScript', default_branch: 'main', visibility: 'private', topics: ['bookings', 'express'],
};
function contents(p, body, ref, sha) {
  return {
    type: 'file', encoding: 'base64', size: Buffer.byteLength(body), name: path.basename(p), path: p, content: b64(body), sha,
    url: `${API}/contents/${p}?ref=${encodeURIComponent(ref)}`, git_url: `${API}/git/blobs/${sha}`,
    html_url: `https://github.com/${OWNER}/${REPO}/blob/${ref}/${p}`,
    download_url: `https://raw.githubusercontent.com/${OWNER}/${REPO}/${ref}/${p}`,
    _links: { self: `${API}/contents/${p}?ref=${ref}`, git: `${API}/git/blobs/${sha}`, html: `https://github.com/${OWNER}/${REPO}/blob/${ref}/${p}` },
  };
}
function branch(name, sha, message, date) {
  return {
    name, protected: name === 'main',
    commit: { sha, node_id: 'C_kwDOLpBxeNoAKD' + sha.slice(0, 10), url: `${API}/commits/${sha}`, html_url: `https://github.com/${OWNER}/${REPO}/commit/${sha}`,
      commit: { author: { name: 'Dev Patel', email: 'dev.patel@staywell.example', date }, committer: { name: 'GitHub', email: 'noreply@github.com', date }, message } },
    _links: { self: `${API}/branches/${encodeURIComponent(name)}`, html: `https://github.com/${OWNER}/${REPO}/tree/${name}` },
  };
}

const readmeMain = `# StayWell booking-service

Express API behind the StayWell "Manage booking" page: create, look up and cancel bookings.

## Business rules

- Cancellations made at least 48 hours before check-in are free of charge.
- Late cancellation fee: 20% of the booking total.
- Refunds are issued within 3 days of cancellation.
- Refund amounts are rounded to 2 decimal places.
- Cancelling an already cancelled booking returns HTTP 409.
- Cancellation events are written to the audit log.

## Running locally

\`npm start\` then open http://localhost:4100.
`;
const cancellationMain = `'use strict';
// Cancellation pricing.
// @rule Late cancellation fee: 20% of the booking total.
const LATE_FEE_PCT = 20;
const FREE_CANCEL_HOURS = 48;
const REFUND_SLA_DAYS = 3;

function toMoney(amount) {
  return Math.floor(amount * 100) / 100;
}

module.exports = { LATE_FEE_PCT, FREE_CANCEL_HOURS, REFUND_SLA_DAYS, toMoney };
`;
const bookingsMain = `'use strict';
/**
 * Booking lookup.
 * @rule Unknown booking IDs return HTTP 404.
 */
function findBooking(store, id) {
  return store.get(id) || null;
}

module.exports = { findBooking };
`;
const readmeFeature = readmeMain
  .replace('Refunds are issued within 3 days of cancellation.', 'Refunds are issued within 2 days of cancellation.')
  .replace('create, look up and cancel bookings.', 'create, look up, change and cancel bookings.')
  .replace('- Cancellation events are written to the audit log.', '- Cancellation events are written to the audit log.\n- Changing the check-in date to a past date returns HTTP 422.');
const cancellationFeature = cancellationMain.replace('REFUND_SLA_DAYS = 3', 'REFUND_SLA_DAYS = 2');
const bookingsFeature = bookingsMain.replace(' */', ` */
function findBookingOr404(store, id) {
  return findBooking(store, id);
}

/**
 * Date changes.
 * @rule Date changes made at least 24 hours before check-in carry no fee.
 */
const FREE_CHANGE_HOURS = 24;
const LATE_CHANGE_FEE = 25;
`).replace('module.exports = { findBooking };', 'module.exports = { findBooking, findBookingOr404, FREE_CHANGE_HOURS, LATE_CHANGE_FEE };');

const MAIN_SHA = '3f9c2a1d8e7b6c5a4f3e2d1c0b9a8f7e6d5c4b3a';
const FEAT_SHA = '9a1b2c3d4e5f60718293a4b5c6d7e8f901234567';
write('github/main/repo.json', repo);
write('github/main/branch.json', branch('main', MAIN_SHA, 'Release 1.4.0: cancellations and refunds', '2026-09-05T15:20:10Z'));
write('github/main/readme.json', contents('README.md', readmeMain, 'main', 'a1f0c3e2b4d6'.padEnd(40, '0')));
write('github/main/contents/src/cancellation.js.json', contents('src/cancellation.js', cancellationMain, 'main', 'b2e1d4f3c5a7'.padEnd(40, '0')));
write('github/main/contents/src/bookings.js.json', contents('src/bookings.js', bookingsMain, 'main', 'c3d2e5a4b6f8'.padEnd(40, '0')));

const fb = 'feature/booking-date-changes';
write('github/feature-booking-date-changes/repo.json', repo);
write('github/feature-booking-date-changes/branch.json', branch(fb, FEAT_SHA, 'Date changes + faster refunds (2-day SLA)', '2026-09-22T08:29:41Z'));
write('github/feature-booking-date-changes/readme.json', contents('README.md', readmeFeature, fb, 'd4c3b6a5e7f9'.padEnd(40, '0')));
write('github/feature-booking-date-changes/contents/src/cancellation.js.json', contents('src/cancellation.js', cancellationFeature, fb, 'e5b4a7f6d8c0'.padEnd(40, '0')));
write('github/feature-booking-date-changes/contents/src/bookings.js.json', contents('src/bookings.js', bookingsFeature, fb, 'f6a5c8b7e9d1'.padEnd(40, '0')));
write('github/feature-booking-date-changes/compare.json', {
  url: `${API}/compare/main...${fb}`, html_url: `https://github.com/${OWNER}/${REPO}/compare/main...${fb}`,
  base_commit: { sha: MAIN_SHA }, merge_base_commit: { sha: MAIN_SHA },
  status: 'ahead', ahead_by: 2, behind_by: 0, total_commits: 2,
  commits: [
    { sha: '71c0de5a9b8e7f6d5c4b3a291807f6e5d4c3b2a1', commit: { message: 'Refund SLA: 3 days -> 2 days', author: { name: 'Dev Patel', date: '2026-09-18T10:02:00Z' } } },
    { sha: FEAT_SHA, commit: { message: 'Date changes + faster refunds (2-day SLA)', author: { name: 'Dev Patel', date: '2026-09-22T08:29:41Z' } } },
  ],
  files: [
    { sha: 'd4c3b6a5e7f9'.padEnd(40, '0'), filename: 'README.md', status: 'modified', additions: 2, deletions: 2, changes: 4 },
    { sha: 'e5b4a7f6d8c0'.padEnd(40, '0'), filename: 'src/cancellation.js', status: 'modified', additions: 1, deletions: 1, changes: 2 },
    { sha: 'f6a5c8b7e9d1'.padEnd(40, '0'), filename: 'src/bookings.js', status: 'modified', additions: 12, deletions: 1, changes: 13 },
  ],
});
console.log('fixtures written to', ROOT);
