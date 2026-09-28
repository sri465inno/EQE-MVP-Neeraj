'use strict';
// What each agent actually produced, read from the persisted cycle, keyed by the artefact names skills declare.
const present = (v) => (v === undefined ? null : v);

const OUTPUTS = {
  normalise: (c) => {
    const g = c.normalisation?.groups;
    const by = (b) => (g ? g.filter((x) => x.bucket === b) : null);
    return {
      statements: { value: present(c.normalisation?.statements) },
      gaps: g ? { value: { jiraOnly: by('jira-only'), codeOnly: by('code-only') }, count: by('jira-only').length + by('code-only').length, allowEmpty: true } : { value: null },
      conflicts: { value: by('conflict'), allowEmpty: true },
    };
  },
  delta: (c) => ({ delta: { value: present(c.delta?.items) } }),
  requirements: (c) => ({ requirements: { value: present(c.artifacts?.requirements) } }),
  rules: (c) => ({ businessRules: { value: present(c.artifacts?.rules) } }),
  testcases: (c) => {
    const t = c.artifacts?.testCases;
    return {
      testCases: { value: present(t) },
      functional: { value: t ? t.filter((x) => x.type === 'functional') : null },
      nonFunctional: { value: t ? t.filter((x) => x.type === 'non-functional') : null },
    };
  },
  scripts: (c) => ({ specs: { value: present(c.artifacts?.scripts) } }),
  execution: (c) => {
    const e = c.artifacts?.execution;
    return { results: { value: e ? e.results.filter((r) => r.status !== 'not-run') : null, note: e ? `${e.summary.notRun} manual case(s) handed over as not run` : null } };
  },
  defects: (c) => ({ defects: { value: present(c.artifacts?.defects), allowEmpty: true } }),
  report: (c) => ({
    cycleReport: { value: present(c.report) },
    testCaseExport: { value: present(c.artifacts?.exports?.testCases) },
    comparison: c.type === 'baseline'
      ? { na: 'Baseline cycle - there is no previous cycle to compare against' }
      : { value: present(c.comparison) },
  }),
};

function producedBy(agentId, cycle) {
  const f = OUTPUTS[agentId];
  return f ? f(cycle) : {};
}

module.exports = { OUTPUTS, producedBy };
