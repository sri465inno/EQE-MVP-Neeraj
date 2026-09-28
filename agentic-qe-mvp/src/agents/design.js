'use strict';
// Design agents, run in a fixed order:
//   requirements repository -> business rules -> test cases -> automation scripts
// All structure and decisions are deterministic; the optional model only drafts prose elsewhere.
const { classify, CATALOGUE } = require('./catalogue');

const pad = (n, w = 3) => String(n).padStart(w, '0');
const clone = (x) => JSON.parse(JSON.stringify(x));

function requirementType(text) {
  const c = classify(text);
  if (c?.entry.type) return c.entry.type;
  return /performance|latency|response time|availability|uptime|security|accessib/i.test(text) ? 'non-functional' : 'functional';
}

function requirementTitle(text) {
  const c = classify(text);
  if (c) return c.entry.title;
  return text.replace(/[.]$/, '').split(/\s+/).slice(0, 7).join(' ');
}

function newRequirement(item, id, cycle) {
  return {
    id,
    title: requirementTitle(item.text),
    text: item.text,
    values: item.values,
    type: requirementType(item.text),
    sources: item.sources,
    bucket: item.bucket,
    origins: item.origins,
    jiraKeys: [...new Set(item.origins.filter((o) => o.source === 'jira' && o.ref && /^[A-Z]+-\d+$/.test(o.ref)).map((o) => o.ref))],
    resolution: item.resolution,
    version: 1,
    status: 'new',
    previous: null,
    introducedInCycle: cycle.id,
    changedInCycle: cycle.id,
  };
}

/** Agent 1 (baseline): the reviewed requirement set becomes the requirement repository. */
function requirementsAgentBaseline(reviewed, { cycle, counters }) {
  return reviewed.map((item) => {
    counters.req += 1;
    return newRequirement(item, `REQ-${pad(counters.req)}`, cycle);
  });
}

/** Agent 1 (incremental): baseline requirements carried over, enhanced ones updated, new ones added. */
function requirementsAgentIncremental(baselineReqs, delta, { cycle, counters }) {
  const byId = new Map(baselineReqs.map((r) => [r.id, { ...clone(r), status: 'carried over' }]));
  const added = [];
  for (const d of delta.items) {
    if (d.classification === 'unchanged') {
      byId.get(d.baselineRequirementId).status = 'unchanged';
    } else if (d.classification === 'enhanced') {
      const old = byId.get(d.baselineRequirementId);
      byId.set(old.id, {
        ...old,
        title: requirementTitle(d.incoming.text),
        text: d.incoming.text,
        values: d.incoming.values,
        type: requirementType(d.incoming.text),
        sources: d.incoming.sources,
        origins: d.incoming.origins,
        jiraKeys: [...new Set([...old.jiraKeys, ...d.incoming.origins.filter((o) => o.source === 'jira' && /^[A-Z]+-\d+$/.test(o.ref || '')).map((o) => o.ref)])],
        resolution: d.incoming.resolution,
        version: old.version + 1,
        status: 'enhanced',
        previous: { text: old.text, values: old.values, version: old.version, origins: old.origins },
        changedInCycle: cycle.id,
      });
    } else {
      counters.req += 1;
      added.push(newRequirement(d.incoming, `REQ-${pad(counters.req)}`, cycle));
    }
  }
  return [...byId.values(), ...added];
}

const CHANGED = new Set(['new', 'enhanced']);

/** Which requirements need (re-)design: new, enhanced, or depending on the rule of one that changed. */
function affectedRequirementIds(requirements) {
  const kindOf = new Map(requirements.map((r) => [r.id, classify(r.text)?.entry.kind || null]));
  const changedKinds = new Set(requirements.filter((r) => CHANGED.has(r.status)).map((r) => kindOf.get(r.id)).filter(Boolean));
  const out = new Set();
  for (const r of requirements) {
    if (CHANGED.has(r.status)) { out.add(r.id); continue; }
    const entry = CATALOGUE.find((e) => e.kind === kindOf.get(r.id));
    if (entry?.dependsOn?.some((k) => changedKinds.has(k))) out.add(r.id);
  }
  return out;
}

function buildRule(req, id) {
  const c = classify(req.text);
  return {
    id,
    requirementId: req.id,
    kind: c ? c.entry.kind : 'unclassified',
    title: c ? c.entry.title : requirementTitle(req.text),
    statement: req.text,
    parameters: c ? c.params : Object.fromEntries(req.values.map((v, i) => [`value${i + 1}`, `${v.num}${v.unit ? ' ' + v.unit : ''}`])),
    executable: Boolean(c),
    quotes: req.origins.map((o) => ({ source: o.source, ref: o.ref, line: o.line || null, url: o.url || null, text: o.quote })),
  };
}

function manualCase(req) {
  return {
    slot: 'manual', priority: 'Low', manual: true,
    name: `Verify: ${req.text.replace(/[.]$/, '')}`,
    objective: `Confirm the behaviour "${req.text}" (no executable template in the catalogue - manual verification).`,
    precondition: 'Access to the system under test and its operational logs.',
    steps: ['Perform the action described by the requirement', 'Observe the outcome in the system or its logs'],
    testData: 'n/a', expected: req.text,
  };
}

/**
 * Agents 2-4: business rules, test cases and scripts.
 * With `previous` (incremental), unaffected artifacts are carried over untouched and
 * affected ones are re-designed, keeping their keys and the superseded version.
 */
function designAgents(requirements, { cycle, counters, previous = null }) {
  const affected = previous ? affectedRequirementIds(requirements) : new Set(requirements.map((r) => r.id));
  const paramsByKind = new Map();
  for (const r of requirements) {
    const c = classify(r.text);
    if (c && !paramsByKind.has(c.entry.kind)) paramsByKind.set(c.entry.kind, c.params);
  }
  const ctx = { paramsOf: (kind) => paramsByKind.get(kind) };
  const prevRules = new Map((previous?.rules || []).map((x) => [x.requirementId, x]));
  const prevCases = new Map((previous?.testCases || []).map((x) => [`${x.requirementId}|${x.slot}`, x]));
  const prevScripts = new Map((previous?.scripts || []).map((x) => [x.requirementId, x]));

  const rules = [];
  const testCases = [];
  const scripts = [];

  for (const req of requirements) {
    if (!affected.has(req.id) && prevRules.has(req.id)) {
      rules.push({ ...clone(prevRules.get(req.id)), status: 'carried over' });
      for (const tc of (previous.testCases || []).filter((t) => t.requirementId === req.id)) {
        testCases.push({ ...clone(tc), status: 'carried over', labels: [...new Set([...tc.labels, 'regression'])], cycle: cycle.name });
      }
      if (prevScripts.has(req.id)) scripts.push({ ...clone(prevScripts.get(req.id)), status: 'carried over' });
      continue;
    }
    const redesign = Boolean(previous && prevRules.has(req.id));
    const prevRule = prevRules.get(req.id);
    let ruleId = prevRule?.id;
    if (!ruleId) { counters.rule += 1; ruleId = `BR-${pad(counters.rule)}`; }
    const rule = { ...buildRule(req, ruleId), status: redesign ? 're-designed' : 'new', version: redesign ? prevRule.version + 1 : 1,
      previous: redesign ? { statement: prevRule.statement, parameters: prevRule.parameters, version: prevRule.version } : null };
    rules.push(rule);

    const c = classify(req.text);
    const specs = (c && c.entry.cases(c.params, ctx)) || [manualCase(req)];
    const scriptFile = c && !specs[0].manual ? `${req.id}.${c.entry.kind}.spec.js` : null;
    const reqCases = specs.map((s) => {
      const prev = prevCases.get(`${req.id}|${s.slot}`);
      let key = prev?.key;
      if (!key) { counters.case += 1; key = `AQE-T${counters.case}`; }
      const automated = !s.manual && Boolean(scriptFile);
      const labels = [req.type === 'functional' ? 'functional' : 'non-functional', ...(automated ? ['automation'] : [])];
      const tc = {
        key, requirementId: req.id, ruleId, slot: s.slot, kind: c ? c.entry.kind : 'unclassified',
        name: s.name, objective: s.objective, precondition: s.precondition, steps: s.steps, testData: s.testData,
        expected: s.expected, priority: s.priority, type: req.type, labels,
        automation: automated ? 'Automated' : 'Not automated', scriptFile: automated ? scriptFile : null,
        issueLinks: req.jiraKeys, cycle: cycle.name,
        status: prev ? 're-designed' : 'new', version: prev ? prev.version + 1 : 1,
        previous: prev ? { name: prev.name, expected: prev.expected, testData: prev.testData, version: prev.version } : null,
        ui: Boolean(c?.entry.ui),
        code: automated ? s.code() : null,
      };
      return tc;
    });
    testCases.push(...reqCases.map(({ code, ...rest }) => rest));
    if (scriptFile) {
      const prevScript = prevScripts.get(req.id);
      const code = renderSpec(req, reqCases);
      const changed = !prevScript || prevScript.code !== code;
      scripts.push({
        file: scriptFile, requirementId: req.id, covers: reqCases.map((t) => t.key), code,
        status: !prevScript ? 'new' : (changed ? 're-designed' : 'carried over'),
        version: !prevScript ? 1 : prevScript.version + (changed ? 1 : 0),
        previous: prevScript && changed ? { code: prevScript.code, version: prevScript.version } : null,
      });
    }
  }
  return { rules, testCases, scripts, affected: [...affected] };
}

function renderSpec(req, cases) {
  const tests = cases.map((tc) => `test(${JSON.stringify(`[${tc.key}] ${tc.name}`)}, async ({ ${tc.ui ? 'page, request' : 'request'} }, testInfo) => {
${tc.code}
});`).join('\n\n');
  return `// Generated by Agentic QE Platform - MVP (automation script agent).
// Requirement: ${req.id} v${req.version} - ${req.text}
// Covers test cases: ${cases.map((t) => t.key).join(', ')}
// Self-contained: needs only @playwright/test and a baseURL pointing at the system under test.
const { test, expect } = require('@playwright/test');

const HOUR = 3600 * 1000;
const inHours = (h) => new Date(Date.now() + h * HOUR).toISOString();

async function call(request, testInfo, method, url, data) {
  const res = await request.fetch(url, { method, data });
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  await testInfo.attach(\`\${method} \${url}\`, {
    body: JSON.stringify({ request: { method, url, data: data ?? null }, response: { status: res.status(), body } }, null, 2),
    contentType: 'application/json',
  });
  return { status: res.status(), body };
}

async function book(request, testInfo, total, checkInHours) {
  const r = await call(request, testInfo, 'POST', '/api/bookings', { guest: 'QE Agent', total, checkIn: inHours(checkInHours) });
  expect(r.status).toBe(201);
  return r.body;
}

${tests}
`;
}

module.exports = { requirementsAgentBaseline, requirementsAgentIncremental, designAgents, affectedRequirementIds, renderSpec };
