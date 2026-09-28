'use strict';
// Design agents, run in a fixed order:
//   requirements repository -> business rules -> test cases -> automation scripts
// All structure and decisions are deterministic; the optional model only drafts prose elsewhere.
const { classify, CATALOGUE, MONEY_KINDS, SPEC_PRELUDE } = require('./catalogue');

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
      d.requirementId = d.baselineRequirementId;
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
      d.requirementId = old.id;
    } else {
      counters.req += 1;
      d.requirementId = `REQ-${pad(counters.req)}`;
      added.push(newRequirement(d.incoming, d.requirementId, cycle));
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

function provenanceOf(cycle, slot) {
  const input = (cycle.inputs || []).find((i) => i.slot === slot);
  return input ? input.provenance.kind : null;
}

/** Source references behind a requirement: Jira issue keys, else repository paths. */
function sourceRefs(req) {
  if (req.jiraKeys.length) return req.jiraKeys;
  return [...new Set(req.origins.filter((o) => o.ref).map((o) => o.ref))];
}

function buildRule(req, id, cycle) {
  const c = classify(req.text);
  return {
    id,
    requirementId: req.id,
    kind: c ? c.entry.kind : 'unclassified',
    title: c ? c.entry.title : requirementTitle(req.text),
    statement: req.text,
    parameters: c ? c.params : Object.fromEntries(req.values.map((v, i) => [`value${i + 1}`, `${v.num}${v.unit ? ' ' + v.unit : ''}`])),
    executable: Boolean(c),
    quotes: req.origins.map((o) => ({ source: o.source, ref: o.ref, line: o.line || null, url: o.url || null, text: o.quote, provenance: provenanceOf(cycle, o.input) })),
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
function designAgents(requirements, { cycle, counters, previous = null, skills = {} }) {
  const used = (agent) => (skills[agent]?.skills || []).map((x) => x.id);
  counters.caseF = counters.caseF || 0;
  counters.caseN = counters.caseN || 0;
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
    const rule = { ...buildRule(req, ruleId, cycle), designedWith: used('rules'), status: redesign ? 're-designed' : 'new', version: redesign ? prevRule.version + 1 : 1,
      previous: redesign ? { statement: prevRule.statement, parameters: prevRule.parameters, version: prevRule.version } : null };
    rules.push(rule);

    const c = classify(req.text);
    const specs = (c && c.entry.cases(c.params, ctx)) || [manualCase(req)];
    const scriptFile = c && !specs[0].manual ? `${ruleId.toLowerCase()}-${c.entry.kind}.spec.js` : null;
    const reqCases = specs.map((s) => {
      const prev = prevCases.get(`${req.id}|${s.slot}`);
      let key = prev?.key;
      if (!key) {
        const nf = req.type === 'non-functional';
        counters[nf ? 'caseN' : 'caseF'] += 1;
        key = `TC-${nf ? 'N' : 'F'}-${pad(counters[nf ? 'caseN' : 'caseF'])}`;
      }
      const automated = !s.manual && Boolean(scriptFile);
      const labels = [req.type === 'functional' ? 'functional' : 'non-functional', ...(automated ? ['automation'] : [])];
      const tc = {
        key, requirementId: req.id, ruleId, slot: s.slot, kind: c ? c.entry.kind : 'unclassified',
        name: s.name, objective: s.objective, precondition: s.precondition, steps: s.steps, testData: s.testData,
        expected: s.expected, priority: s.manual ? 'Low' : (c && MONEY_KINDS.has(c.entry.kind) ? 'High' : 'Medium'), type: req.type, labels,
        automation: automated ? 'Automated' : 'Not automated', scriptFile: automated ? scriptFile : null,
        issueLinks: req.jiraKeys, sourceRefs: sourceRefs(req), cycle: cycle.name, designedWith: used('testcases'),
        status: prev ? 're-designed' : 'new', version: prev ? prev.version + 1 : 1,
        previous: prev ? { name: prev.name, expected: prev.expected, testData: prev.testData, version: prev.version } : null,
        revisionNote: prev ? `v${prev.version + 1} (${cycle.id}): ${revision(prev, s)}` : null,
        ui: Boolean(c?.entry.ui), varies: s.varies || [],
        code: automated ? s.code() : null,
      };
      return tc;
    });
    testCases.push(...reqCases.map(({ code, ...rest }) => rest));
    if (scriptFile) {
      const prevScript = prevScripts.get(req.id);
      const code = renderSpec(req, reqCases, { rule, skills: used('scripts') });
      const changed = !prevScript || prevScript.code !== code;
      scripts.push({
        file: scriptFile, requirementId: req.id, ruleId, designedWith: used('scripts'), covers: reqCases.map((t) => t.key), code,
        status: !prevScript ? 'new' : (changed ? 're-designed' : 'carried over'),
        version: !prevScript ? 1 : prevScript.version + (changed ? 1 : 0),
        previous: prevScript && changed ? { code: prevScript.code, version: prevScript.version } : null,
      });
    }
  }
  return { rules, testCases, scripts, affected: [...affected] };
}

function revision(prev, s) {
  const changed = ['name', 'expected', 'testData'].filter((f) => prev[f] !== s[f]);
  if (!changed.length) return 're-designed because a rule it depends on changed; case text unchanged';
  return changed.map((f) => `${f} was "${prev[f]}"`).join('; ');
}

function renderSpec(req, cases, { rule, skills = [] } = {}) {
  const tests = cases.map((tc) => `test(${JSON.stringify(`${tc.key} ${tc.name}`)}, async ({ ${tc.ui ? 'page, request' : 'request'} }, testInfo) => {
${tc.code}
});`).join('\n\n');
  const block = [
    'Generated by Agentic QE Platform - MVP (automation script agent).',
    `Business rule: ${rule.id} - ${rule.title}`,
    `Statement: ${rule.statement}`,
    `Requirement: ${req.id} v${req.version}; sources: ${sourceRefs(req).join(', ')}`,
    `Covers test cases: ${cases.map((t) => `${t.key} (${t.name})`).join('; ')}`,
    ...(req.previous ? [`Superseded (v${req.previous.version}): ${req.previous.text}`] : []),
    ...(skills.length ? [`Skills applied: ${skills.join(', ')}`] : []),
  ];
  return `${block.map((l) => `// ${l}`).join('\n')}
// Self-contained: needs only @playwright/test and a baseURL pointing at the system under test.
const { test, expect } = require('@playwright/test');

${SPEC_PRELUDE}

${tests}
`;
}

module.exports = { requirementsAgentBaseline, requirementsAgentIncremental, designAgents, affectedRequirementIds, renderSpec };
