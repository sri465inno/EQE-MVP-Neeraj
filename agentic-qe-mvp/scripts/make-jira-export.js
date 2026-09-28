'use strict';
// Writes the demo Jira export: synthetic test issues (commission initiative + epics + story) in the exact
// response shapes of Jira Cloud REST API v3 (GET /rest/api/3/issue/{key}, POST /rest/api/3/search/jql).
// The same files are published to the demo/jira-export branch of the repo, so the MVP can pull them from GitHub.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'fixtures');
const JIRA = 'https://aurora-hotels.atlassian.net';
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

const project = { self: `${JIRA}/rest/api/3/project/10000`, id: '10000', key: 'COM', name: 'Commission Platform', projectTypeKey: 'software', simplified: false };
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
  id: '20100', key: 'COM-1', type: 'Initiative', summary: 'Travel-advisor commission platform',
  labels: ['commission', 'fy27'], created: '2026-07-06T09:12:44.000+0000', updated: '2026-09-02T14:03:11.000+0000',
  description: doc(
    para('Pay travel advisors the right commission on every eligible reservation, calculated from the reservation attributes instead of the manual month-end spreadsheet. A reservation carries 1000 attributes; only some of them drive commission, and the rules combine them (channel, length of stay, rate plan, room count, payment type, status).'),
    heading('Outcomes'),
    bullets([
      'Every reservation is described by a data dictionary of 1000 attributes.',
      'Travel advisors can view the commission breakdown for a reservation online.',
      'Commission quotes return within 300 ms at the 95th percentile.',
    ]),
  ),
});

const parentRef = { id: '20100', key: 'COM-1', summary: initiative.fields.summary, type: 'Initiative' };

const epic10 = issue({
  id: '20110', key: 'COM-10', type: 'Epic', summary: 'Commission calculation for transient reservations', parent: parentRef,
  labels: ['commission', 'calculation'], created: '2026-07-13T10:20:00.000+0000', updated: '2026-09-08T08:45:31.000+0000',
  description: doc(
    para('Calculate the commission for individual (transient) reservations from their attributes.'),
    heading('Acceptance criteria'),
    bullets([
      'Base commission is 10% of commissionable room revenue.',
      'Commissionable room revenue excludes taxes, resort fees and ancillary charges.',
      'Reservations booked through the GDS channel earn an additional 2% channel uplift.',
      'Stays of 7 nights or more earn a long-stay bonus of 1.5%.',
      'Commission per reservation is capped at USD 500.',
      'Commission is rounded half-up to 2 decimal places.',
    ]),
  ),
});

const story11 = issue({
  id: '20111', key: 'COM-11', type: 'Story', summary: 'Exclude non-commissionable reservations', priority: 'Medium',
  parent: { id: '20110', key: 'COM-10', summary: epic10.fields.summary, type: 'Epic' },
  labels: ['commission', 'eligibility'], status: 'To Do', created: '2026-07-14T11:02:19.000+0000', updated: '2026-09-01T16:22:05.000+0000',
  description: doc(
    para('As a commission analyst I want reservations that must not pay commission to be excluded automatically.'),
    heading('Acceptance criteria'),
    bullets([
      'Reservations paid with loyalty points are not commissionable.',
      'Cancelled and no-show reservations earn no commission.',
    ]),
  ),
});

const epic20 = issue({
  id: '20120', key: 'COM-20', type: 'Epic', summary: 'Group and package reservation commission', parent: parentRef,
  labels: ['commission', 'groups', 'packages'], status: 'To Do', created: '2026-09-10T09:00:00.000+0000', updated: '2026-09-21T13:37:48.000+0000',
  description: doc(
    para('Extend commission to group blocks and package rates, and raise the per-reservation cap for release 2.0.'),
    heading('Acceptance criteria'),
    bullets([
      'Commission per reservation is capped at USD 750.',
      'Group reservations of 10 or more rooms are commissioned at a flat 8%.',
      'Package rates are commissioned on 70% of the package price.',
    ]),
  ),
});

const search = (issues) => ({ issues, isLast: true });
write('jira/COM-1.json', initiative);
write('jira/COM-10.json', epic10);
write('jira/COM-10.children.json', search([story11]));
write('jira/COM-11.json', story11);
write('jira/COM-20.json', epic20);
write('jira/COM-20.children.json', search([]));
console.log('wrote fixtures/jira/COM-*.json');
