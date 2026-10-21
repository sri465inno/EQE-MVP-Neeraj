'use strict';
// Jira REST v3 client (works against the local mock Jira or any Jira Cloud site with the same API).
const JIRA_URL = process.env.JIRA_URL || 'http://localhost:4200';

async function call(method, p, body) {
  const r = await fetch(JIRA_URL + p, { method, headers: { 'content-type': 'application/json', accept: 'application/json' }, body: body && JSON.stringify(body) });
  if (r.status === 204) return null;
  const t = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Jira ${method} ${p} -> ${r.status} ${JSON.stringify(t)}`);
  return t;
}
const search = async (jql) => (await call('GET', `/rest/api/3/search/jql?maxResults=200&jql=${encodeURIComponent(jql)}`)).issues;

const adfText = (n) => (!n ? '' : n.type === 'text' ? n.text : (n.content || []).map(adfText).join(''));
// Splits a story description into text, "Acceptance criteria" and "Test data" (lines "Name: value").
function parseDescription(doc) {
  const text = [], ac = [], td = []; let sec = null;
  for (const n of (doc && doc.content) || []) {
    if (n.type === 'heading') { const h = adfText(n); sec = /acceptance criteria/i.test(h) ? ac : /test data/i.test(h) ? td : null; continue; }
    if (n.type === 'bulletList' || n.type === 'orderedList') (n.content || []).forEach((li) => (sec || text).push(adfText(li).trim()));
    else if (sec && n.type === 'paragraph') adfText(n).split('\n').filter(Boolean).forEach((l) => sec.push(l.trim()));
    else text.push(adfText(n));
  }
  const testData = Object.fromEntries(td.map((l) => l.match(/^([^:]+):\s*(.*)$/)).filter(Boolean).map((m) => [m[1].trim(), m[2].trim()]));
  return { text: text.filter(Boolean).join('\n\n'), ac, testData };
}
const p = (t) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] });
const adf = (paragraphs) => ({ type: 'doc', version: 1, content: paragraphs.filter(Boolean).map(p) });

module.exports = {
  JIRA_URL, call, search, parseDescription, adf,
  projects: () => call('GET', '/rest/api/3/project'),
  issue: (k) => call('GET', `/rest/api/3/issue/${k}`),
  createIssue: (fields) => call('POST', '/rest/api/3/issue', { fields, reporter: 'EQE Dashboard' }),
  comment: (k, text) => call('POST', `/rest/api/3/issue/${k}/comment`, { body: adf([text]), author: 'EQE Dashboard' }),
  serverInfo: () => call('GET', '/rest/api/3/serverInfo'),
};
