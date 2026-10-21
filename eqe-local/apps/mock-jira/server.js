'use strict';
// Mock Jira: a small, local stand-in for Jira Cloud REST API v3 (the subset the EQE dashboard needs) plus a simple UI.
const path = require('path');
const fs = require('fs');
const express = require('express');
const SEED = require('./seed');

const PORT = Number(process.env.PORT || 4200);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data', 'jira');
const FILE = path.join(DATA_DIR, 'issues.json');
const BASE = `http://localhost:${PORT}`;
const PROJECTS = [
  { id: '10000', key: 'EQE', name: 'EQE · StayEase online booking', projectTypeKey: 'software', lead: { displayName: 'Automation Lead' } },
  { id: '10001', key: 'MGPP', name: 'MGPP · Portfolio initiatives', projectTypeKey: 'business', lead: { displayName: 'Automation Lead' } },
];
// Initiatives live in the MGPP portfolio project; epics, stories, tasks and bugs in EQE.
const projectOf = (key) => PROJECTS.find((p) => p.key === String(key).split('-')[0]) || PROJECTS[0];
const STATUSES = ['To Do', 'In Progress', 'In Review', 'Done'];
fs.mkdirSync(DATA_DIR, { recursive: true });

// ---- Atlassian Document Format helpers ----
const p = (t) => ({ type: 'paragraph', content: t ? [{ type: 'text', text: t }] : [] });
const toAdf = (text, ac = [], td = []) => ({
  type: 'doc', version: 1,
  content: [...String(text || '').split(/\n{2,}/).filter(Boolean).map(p),
    ...(ac.length ? [{ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Acceptance criteria' }] },
      { type: 'bulletList', content: ac.map((a) => ({ type: 'listItem', content: [p(a)] })) }] : []),
    ...(td.length ? [{ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Test data' }] },
      { type: 'bulletList', content: td.map((a) => ({ type: 'listItem', content: [p(a)] })) }] : [])],
});
const adfText = (n) => (!n ? '' : n.type === 'text' ? n.text : (n.content || []).map(adfText).join(n.type === 'doc' || n.type === 'bulletList' ? '\n' : ''));
function fromAdf(doc) {
  const text = [], ac = [], testData = []; let sec = null;
  for (const n of (doc && doc.content) || []) {
    if (n.type === 'heading') { const h = adfText(n); sec = /acceptance criteria/i.test(h) ? ac : /test data/i.test(h) ? testData : null; continue; }
    if (n.type === 'bulletList' || n.type === 'orderedList') (n.content || []).forEach((li) => (sec || text).push(adfText(li).trim()));
    else text.push(adfText(n));
  }
  return { text: text.join('\n\n'), ac, testData };
}

// ---- persistence ----
let db;
const now = () => new Date().toISOString();
function seed() {
  const t = now();
  db = { nextId: 10001, nextNum: 1, nextMgpp: 1, issues: [] };
  for (const s of SEED) addIssue({ ...s, reporter: 'Automation Lead', created: t });
  persist();
}
function load() { if (fs.existsSync(FILE)) { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); migrate(); } else seed(); }
// Older data kept initiatives in EQE: move them to MGPP and keep the old key as an alias so links still resolve.
function migrate() {
  db.nextMgpp = db.nextMgpp || 1;
  let changed = false;
  for (const i of db.issues.filter((x) => x.type === 'Initiative' && !x.key.startsWith('MGPP-'))) {
    const old = i.key; const nk = `MGPP-${db.nextMgpp++}`;
    i.key = nk; i.aliases = [...(i.aliases || []), old];
    db.issues.forEach((x) => { if (x.parent === old) x.parent = nk; });
    changed = true;
  }
  // Seed stories gained acceptance criteria later: refresh a seeded story's description when one is missing.
  for (const s of SEED.filter((x) => x.key && (x.ac || []).length)) {
    const i = db.issues.find((x) => x.key === s.key);
    const desc = i && JSON.stringify(i.description);
    if (i && s.ac.some((a) => !desc.includes(JSON.stringify(a).slice(1, -1)))) { i.description = toAdf(s.text, s.ac, s.testData); i.updated = now(); changed = true; }
  }
  if (changed) persist();
}
function persist() { fs.writeFileSync(FILE, JSON.stringify(db, null, 2)); }
function addIssue({ key, type, summary, parent, priority, text, ac, testData, labels, reporter, created, status, extra }) {
  const prefix = key ? key.split('-')[0] : type === 'Initiative' ? 'MGPP' : 'EQE';
  const counter = prefix === 'MGPP' ? 'nextMgpp' : 'nextNum';
  db[counter] = db[counter] || 1;
  const num = key ? Number(key.split('-')[1]) : db[counter];
  db[counter] = Math.max(db[counter], num + 1);
  const issue = {
    id: String(db.nextId++), key: key || `${prefix}-${num}`, type, summary, parent: parent || null, priority: priority || 'Medium',
    status: status || 'To Do', description: toAdf(text, ac, testData), labels: labels || [], reporter: reporter || 'Automation Lead',
    created: created || now(), updated: created || now(), comments: [], extra: extra || {},
  };
  db.issues.push(issue);
  return issue;
}
load();

const view = (i) => {
  const parent = i.parent && db.issues.find((x) => x.key === i.parent);
  return {
    id: i.id, key: i.key, self: `${BASE}/rest/api/3/issue/${i.id}`,
    fields: {
      summary: i.summary, issuetype: { name: i.type, hierarchyLevel: { Initiative: 2, Epic: 1, Story: 0, Bug: 0, Task: 0 }[i.type] ?? 0 },
      status: { name: i.status }, priority: { name: i.priority }, labels: i.labels, description: i.description,
      project: { key: projectOf(i.key).key, name: projectOf(i.key).name },
      parent: parent ? { key: parent.key, fields: { summary: parent.summary, issuetype: { name: parent.type } } } : undefined,
      reporter: { displayName: i.reporter }, created: i.created, updated: i.updated,
      comment: { comments: i.comments, total: i.comments.length }, ...i.extra,
    },
  };
};

// Minimal JQL: clauses joined by AND; supports =, !=, in (...), ~ and ORDER BY key.
function jql(q) {
  const where = String(q || '').split(/\border\s+by\b/i)[0].trim();
  if (!where) return db.issues;
  const clauses = where.split(/\s+and\s+/i);
  const val = (v) => v.trim().replace(/^["']|["']$/g, '');
  return db.issues.filter((i) => clauses.every((c) => {
    const m = c.match(/^\s*(\w+)\s*(!=|=|~|\bin\b|\bnot in\b)\s*(.+)$/i);
    if (!m) return true;
    const [, f, op, raw] = m;
    const field = { project: () => projectOf(i.key).key, key: () => i.key, issuetype: () => i.type, type: () => i.type, parent: () => i.parent, status: () => i.status,
      priority: () => i.priority, labels: () => i.labels.join(' '), summary: () => i.summary, text: () => `${i.summary} ${JSON.stringify(i.description)}` }[f.toLowerCase()];
    if (!field) return true;
    const actual = String(field() || '').toLowerCase();
    const o = op.toLowerCase();
    if (o === 'in' || o === 'not in') {
      const set = raw.replace(/^\(|\)$/g, '').split(',').map((x) => val(x).toLowerCase());
      return o === 'in' ? set.includes(actual) : !set.includes(actual);
    }
    if (o === '~') return actual.includes(val(raw).toLowerCase());
    if (f.toLowerCase() === 'labels') return actual.split(' ').includes(val(raw).toLowerCase()) === (o === '=');
    return (actual === val(raw).toLowerCase()) === (o === '=');
  }));
}

const app = express();
app.use(express.json({ limit: '1mb' }));
const find = (k) => db.issues.find((x) => x.key === k || x.id === k) || db.issues.find((x) => (x.aliases || []).includes(k));

app.get('/rest/api/3/serverInfo', (req, res) => res.json({ baseUrl: BASE, version: 'mock-1.0', deploymentType: 'Cloud', serverTitle: 'Mock Jira (local)' }));
app.get('/rest/api/3/myself', (req, res) => res.json({ displayName: 'Automation Lead', emailAddress: 'automation.lead@example.com' }));
app.get('/rest/api/3/project', (req, res) => res.json(PROJECTS));
app.get('/rest/api/3/project/:key', (req, res) => (PROJECTS.find((x) => x.key === req.params.key) ? res.json(PROJECTS.find((x) => x.key === req.params.key)) : res.status(404).json({ errorMessages: ['No project could be found'] })));
const search = (q, res) => {
  const all = jql(q.jql).sort((a, b) => (a.key.startsWith('MGPP') === b.key.startsWith('MGPP') ? Number(a.key.split('-')[1]) - Number(b.key.split('-')[1]) : a.key.startsWith('MGPP') ? -1 : 1));
  const startAt = Number(q.startAt || 0), max = Number(q.maxResults || 100);
  res.json({ startAt, maxResults: max, total: all.length, issues: all.slice(startAt, startAt + max).map(view) });
};
app.get('/rest/api/3/search', (req, res) => search(req.query, res));
app.get('/rest/api/3/search/jql', (req, res) => search(req.query, res));
app.post('/rest/api/3/search/jql', (req, res) => search(req.body || {}, res));
app.get('/rest/api/3/issue/:key', (req, res) => { const i = find(req.params.key); return i ? res.json(view(i)) : res.status(404).json({ errorMessages: ['Issue does not exist'] }); });

function fieldsIn(f = {}) {
  const desc = typeof f.description === 'string' ? { text: f.description, ac: [] } : f.description ? fromAdf(f.description) : null;
  if (desc && Array.isArray(f.acceptanceCriteria)) desc.ac = f.acceptanceCriteria;
  if (desc && Array.isArray(f.testData)) desc.testData = f.testData;
  return { desc, type: f.issuetype?.name, summary: f.summary, parent: f.parent?.key, priority: f.priority?.name, labels: f.labels, status: f.status?.name };
}
const extraOf = (f = {}) => Object.fromEntries(Object.entries(f).filter(([k]) => k.startsWith('customfield_')));
app.post('/rest/api/3/issue', (req, res) => {
  const f = req.body?.fields || {}; const x = fieldsIn(f);
  if (!x.summary || !x.type) return res.status(400).json({ errors: { summary: x.summary ? undefined : 'Summary is required', issuetype: x.type ? undefined : 'Issue type is required' } });
  if (x.parent && !find(x.parent)) return res.status(400).json({ errors: { parent: 'Parent issue does not exist' } });
  const i = addIssue({ type: x.type, summary: x.summary, parent: x.parent, priority: x.priority, text: x.desc?.text, ac: x.desc?.ac, testData: x.desc?.testData, labels: x.labels, reporter: req.body.reporter || 'Automation Lead', extra: extraOf(f) });
  persist();
  res.status(201).json({ id: i.id, key: i.key, self: `${BASE}/rest/api/3/issue/${i.id}` });
});
app.put('/rest/api/3/issue/:key', (req, res) => {
  const i = find(req.params.key); if (!i) return res.status(404).json({ errorMessages: ['Issue does not exist'] });
  const x = fieldsIn(req.body?.fields || {});
  if (x.summary) i.summary = x.summary; if (x.type) i.type = x.type; if (x.priority) i.priority = x.priority;
  if (x.parent !== undefined) i.parent = x.parent || null; if (x.labels) i.labels = x.labels; if (x.status && STATUSES.includes(x.status)) i.status = x.status;
  if (x.desc) i.description = toAdf(x.desc.text, x.desc.ac, x.desc.testData ?? fromAdf(i.description).testData);
  Object.assign(i.extra, extraOf(req.body?.fields));
  i.updated = now(); persist(); res.status(204).end();
});
app.delete('/rest/api/3/issue/:key', (req, res) => {
  const i = find(req.params.key); if (!i) return res.status(404).end();
  if (db.issues.some((x) => x.parent === i.key)) return res.status(400).json({ errorMessages: ['Issue has child issues'] });
  db.issues = db.issues.filter((x) => x !== i); persist(); res.status(204).end();
});
app.post('/rest/api/3/issue/:key/comment', (req, res) => {
  const i = find(req.params.key); if (!i) return res.status(404).end();
  const body = typeof req.body?.body === 'string' ? toAdf(req.body.body) : req.body?.body;
  const c = { id: String(Date.now()), author: { displayName: req.body?.author || 'EQE Dashboard' }, body, created: now() };
  i.comments.push(c); i.updated = now(); persist(); res.status(201).json(c);
});
app.post('/rest/api/3/issue/:key/transitions', (req, res) => {
  const i = find(req.params.key); if (!i) return res.status(404).end();
  const to = req.body?.transition?.name || req.body?.transition?.id;
  if (!STATUSES.includes(to)) return res.status(400).json({ errorMessages: ['Unknown transition'] });
  i.status = to; i.updated = now(); persist(); res.status(204).end();
});

// UI helpers (not part of the Jira API)
app.get('/ui/issues', (req, res) => res.json(db.issues.map((i) => ({ ...i, ...fromAdf(i.description) }))));
app.post('/ui/reset', (req, res) => { seed(); res.json({ ok: true, count: db.issues.length }); });
app.use(express.static(path.join(__dirname, 'public')));
app.listen(PORT, () => console.log(`Mock Jira on ${BASE}`));
