'use strict';
// Writes fixtures/jira/ from a Jira REST API v3 search response (POST /rest/api/3/search/jql, fields as in FIELDS):
// one <KEY>.json per issue and, for every issue with children, <KEY>.children.json listing them.
//   node scripts/import-jira-export.js <search-response.json> [site base URL]
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'fixtures', 'jira');
const KEEP = ['summary', 'description', 'issuetype', 'status', 'priority', 'labels', 'parent', 'project', 'issuelinks', 'duedate', 'customfield_10015'];
const keyNo = (k) => Number(k.split('-')[1]);

function importExport(search, { out = OUT, site = null } = {}) {
  const issues = search.issues.map((iss) => ({
    key: iss.key, id: iss.id, self: iss.self,
    ...(site ? { _site: site } : {}),
    fields: Object.fromEntries(KEEP.filter((f) => iss.fields[f] !== undefined).map((f) => [f, iss.fields[f]])),
  }));
  const byKey = new Map(issues.map((i) => [i.key, i]));
  const children = new Map();
  for (const iss of issues) {
    const parent = iss.fields.parent?.key;
    if (parent && byKey.has(parent)) children.set(parent, [...(children.get(parent) || []), iss]);
  }
  fs.mkdirSync(out, { recursive: true });
  const write = (name, body) => fs.writeFileSync(path.join(out, `${name}.json`), `${JSON.stringify(body, null, 2)}\n`);
  for (const iss of issues) write(iss.key, iss);
  for (const [key, list] of children) {
    const sorted = list.sort((a, b) => keyNo(a.key) - keyNo(b.key));
    write(`${key}.children`, { startAt: 0, maxResults: sorted.length, total: sorted.length, isLast: true, issues: sorted });
  }
  return { issues: issues.length, parents: children.size };
}

if (require.main === module) {
  const [file, site] = process.argv.slice(2);
  if (!file) { console.error('usage: node scripts/import-jira-export.js <search-response.json> [site base URL]'); process.exit(1); }
  const r = importExport(JSON.parse(fs.readFileSync(file, 'utf8')), { site: site || null });
  console.log(`wrote ${r.issues} issues and ${r.parents} children files to fixtures/jira/`);
}

module.exports = { importExport };
