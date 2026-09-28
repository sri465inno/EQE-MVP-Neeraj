'use strict';
// Defect agent: raises defects ONLY from test cases whose real execution result is "failed".
const { MONEY_KINDS, JOURNEY_KINDS, ADVISORY_KINDS } = require('./agents/catalogue');

/** Severity comes from the business impact of the rule at risk, not from how the test failed. */
function severityOf(kind) {
  if (MONEY_KINDS.has(kind)) return { severity: 'Critical', impact: 'money moved wrongly' };
  if (JOURNEY_KINDS.has(kind)) return { severity: 'High', impact: 'a core guest journey is blocked' };
  if (ADVISORY_KINDS.has(kind)) return { severity: 'Low', impact: 'advisory (non-functional target missed)' };
  return { severity: 'Medium', impact: 'wrong value or status with a workaround' };
}

function suspectedCodeArea(req) {
  const code = (req?.origins || []).filter((o) => o.source === 'code' && o.ref);
  const src = code.filter((o) => o.kind === 'code-source');
  const pick = src.length ? src : code;
  return pick.length ? [...new Set(pick.map((o) => `${o.ref}${o.line ? `:${o.line}` : ''}`))].join(', ') : 'not identified from the sources';
}

function raiseDefects({ execution, testCases, requirements, cycle, previousDefects = [], startNo = 0 }) {
  if (!execution || execution.executed !== true) throw new Error('Defects can only be raised from a real execution run');
  const caseByKey = new Map(testCases.map((t) => [t.key, t]));
  const reqById = new Map(requirements.map((r) => [r.id, r]));
  const prevByCase = new Map(previousDefects.map((d) => [d.testCaseKey, d]));
  let n = startNo;
  const defects = execution.results.filter((r) => r.status === 'failed').map((r) => {
    const tc = caseByKey.get(r.key);
    const req = reqById.get(r.requirementId);
    const prev = prevByCase.get(r.key);
    let id = prev?.id;
    if (!id) { n += 1; id = `DEF-${String(n).padStart(3, '0')}`; }
    const expected = r.error?.expected ?? tc.expected;
    const actual = r.error?.actual ?? '(see failing assertion)';
    const { severity, impact } = severityOf(tc.kind);
    const blocksRelease = severity === 'Critical' || severity === 'High';
    const occurrence = { cycleId: cycle.id, executedAt: execution.finishedAt, actual, evidence: r.evidence };
    return {
      id,
      title: r.error?.actual != null ? `${tc.name}: returns ${actual} instead of ${expected}` : `${tc.name}: failed`,
      severity,
      impact,
      blocksRelease,
      releaseDecision: blocksRelease ? `Blocks the release: ${impact} (${tc.ruleId}).` : `Does not block the release: ${impact}.`,
      status: 'Open',
      movement: prev ? 'still open' : 'new',
      firstSeenCycle: prev ? prev.firstSeenCycle : cycle.id,
      cycleId: cycle.id,
      testCaseKey: r.key,
      ruleId: tc.ruleId,
      requirementId: r.requirementId,
      requirementText: req?.text,
      jiraKeys: req?.jiraKeys || [],
      sourceRefs: tc.sourceRefs || req?.jiraKeys || [],
      suspectedCodeArea: suspectedCodeArea(req),
      scriptFile: r.scriptFile,
      expected,
      actual,
      assertion: r.error?.assertion || null,
      location: r.error?.location || null,
      errorMessage: r.error?.message || null,
      evidence: r.evidence,
      executedAt: execution.finishedAt,
      occurrences: [...(prev?.occurrences || []), occurrence],
    };
  });
  const failedKeys = new Set(defects.map((d) => d.testCaseKey));
  const resultByKey = new Map(execution.results.map((r) => [r.key, r]));
  const resolved = previousDefects.filter((d) => !failedKeys.has(d.testCaseKey) && resultByKey.get(d.testCaseKey)?.status === 'passed')
    .map((d) => ({ ...d, status: 'Resolved', movement: 'resolved', resolvedInCycle: cycle.id }));
  return { defects, resolved, nextNo: n };
}

module.exports = { raiseDefects, severityOf };
