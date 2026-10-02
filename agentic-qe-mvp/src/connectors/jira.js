'use strict';
const fs = require('fs');
const path = require('path');

const FIXTURE_DIR = path.join(__dirname, '..', '..', 'fixtures', 'jira');
const FIXTURE_BASE = 'https://aurora-hotels.atlassian.net';
// The same Jira REST v3 export, published on a branch of the repo so the MVP can pull it from GitHub.
const EXPORT = {
  repo: 'sri465inno/uc-agentic-quality-engineering',
  branch: 'demo/jira-export',
  rawBase: 'https://raw.githubusercontent.com/sri465inno/uc-agentic-quality-engineering/demo/jira-export/jira',
  htmlBase: 'https://github.com/sri465inno/uc-agentic-quality-engineering/blob/demo/jira-export/jira',
  // Projects exported from a real Jira site; other keys in the export are synthetic test issues.
  sites: { AQPI: 'https://tcs-team-ou6drgfr.atlassian.net' },
};

function jiraLiveConfig(env = process.env) {
  const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN } = env;
  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) return null;
  return { baseUrl: JIRA_BASE_URL.replace(/\/+$/, ''), email: JIRA_EMAIL, token: JIRA_API_TOKEN };
}

const FIELDS = ['summary', 'description', 'issuetype', 'status', 'priority', 'labels', 'parent', 'project'];

async function liveRequest(cfg, fetchImpl, method, urlPath, body) {
  const res = await fetchImpl(`${cfg.baseUrl}${urlPath}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.email}:${cfg.token}`).toString('base64')}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Jira ${method} ${urlPath} failed: HTTP ${res.status}`);
  if (res.status === 204) return {};
  if (typeof res.text !== 'function') return res.json();
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

function readFixture(name) {
  const file = path.join(FIXTURE_DIR, `${name}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function pullExport(name, fetchImpl, rawBase) {
  const res = await fetchImpl(`${rawBase}/${name}.json`, { headers: { Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub pull of jira/${name}.json failed: HTTP ${res.status}`);
  return res.json();
}

/** Pulls an issue from the Jira REST v3 export published on GitHub (not a Jira call). */
async function loadJiraExport(cleanKey, { withChildren, fetchImpl, rawBase = EXPORT.rawBase }) {
  const issue = await pullExport(cleanKey, fetchImpl, rawBase);
  if (!issue) throw new Error(`${cleanKey} is not in the Jira export on ${EXPORT.repo}@${EXPORT.branch}`);
  const children = withChildren ? ((await pullExport(`${cleanKey}.children`, fetchImpl, rawBase)) || { issues: [] }).issues : [];
  const files = [`${cleanKey}.json`, ...(withChildren ? [`${cleanKey}.children.json`] : [])];
  const site = EXPORT.sites[cleanKey.split('-')[0]];
  return {
    issue, children, baseUrl: site || FIXTURE_BASE,
    provenance: {
      kind: 'github',
      system: 'jira',
      label: `Jira export on GitHub (${EXPORT.repo}@${EXPORT.branch}): Jira REST API v3 JSON of ${cleanKey}${site ? `, exported from ${site}` : ' - synthetic test issues'}; no live Jira call was made`,
      ref: cleanKey, fetchedAt: new Date().toISOString(),
      files: files.map((f) => `${EXPORT.htmlBase}/${f}`),
    },
  };
}

/**
 * Loads an issue (and optionally its child issues). With source 'github' it pulls the published export from GitHub. Calls Jira live only when
 * JIRA_BASE_URL/JIRA_EMAIL/JIRA_API_TOKEN are all set; otherwise reads the recorded fixture.
 */
async function loadJiraIssue(key, { withChildren = false, env = process.env, fetchImpl = globalThis.fetch, source = 'jira', exportBase } = {}) {
  const cleanKey = String(key || '').trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(cleanKey)) throw new Error(`"${key}" is not a Jira issue key`);
  if (source === 'github') return loadJiraExport(cleanKey, { withChildren, fetchImpl, rawBase: exportBase });
  const cfg = jiraLiveConfig(env);
  if (cfg) {
    const issue = await liveRequest(cfg, fetchImpl, 'GET', `/rest/api/3/issue/${cleanKey}?fields=${FIELDS.join(',')}`);
    let children = [];
    if (withChildren) {
      const found = await liveRequest(cfg, fetchImpl, 'POST', '/rest/api/3/search/jql', { jql: `parent = ${cleanKey} ORDER BY key ASC`, fields: FIELDS, maxResults: 100 });
      children = found.issues || [];
    }
    return {
      issue, children, baseUrl: cfg.baseUrl,
      provenance: { kind: 'live', label: `Live Jira call to ${cfg.baseUrl}`, ref: cleanKey, fetchedAt: new Date().toISOString() },
    };
  }
  const issue = readFixture(cleanKey);
  if (!issue) throw new Error(`No recorded fixture for ${cleanKey} and Jira is not configured (set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN for live calls)`);
  const children = withChildren ? (readFixture(`${cleanKey}.children`) || { issues: [] }).issues : [];
  return {
    issue, children, baseUrl: FIXTURE_BASE,
    provenance: {
      kind: 'fixture',
      label: `Recorded fixture (Jira REST API v3 shape) - no live Jira call was made`,
      ref: cleanKey,
      files: [`fixtures/jira/${cleanKey}.json`, ...(withChildren ? [`fixtures/jira/${cleanKey}.children.json`] : [])],
    },
  };
}

module.exports = { loadJiraIssue, jiraLiveConfig, liveRequest, FIXTURE_BASE, EXPORT };
