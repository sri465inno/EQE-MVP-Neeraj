'use strict';
// Defect agent: raises defects ONLY from test cases whose real execution result is "failed".

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
    return {
      id,
      title: `${tc.name} - failed`,
      severity: tc.priority === 'High' ? 'Major' : 'Minor',
      status: 'Open',
      movement: prev ? 'still open' : 'new',
      firstSeenCycle: prev ? prev.firstSeenCycle : cycle.id,
      cycleId: cycle.id,
      testCaseKey: r.key,
      requirementId: r.requirementId,
      requirementText: req?.text,
      jiraKeys: req?.jiraKeys || [],
      scriptFile: r.scriptFile,
      expected: r.error?.expected ?? tc.expected,
      actual: r.error?.actual ?? '(see failing assertion)',
      assertion: r.error?.assertion || null,
      location: r.error?.location || null,
      errorMessage: r.error?.message || null,
      evidence: r.evidence,
      executedAt: execution.finishedAt,
    };
  });
  const failedKeys = new Set(defects.map((d) => d.testCaseKey));
  const resultByKey = new Map(execution.results.map((r) => [r.key, r]));
  const resolved = previousDefects.filter((d) => !failedKeys.has(d.testCaseKey) && resultByKey.get(d.testCaseKey)?.status === 'passed')
    .map((d) => ({ ...d, status: 'Resolved', movement: 'resolved', resolvedInCycle: cycle.id }));
  return { defects, resolved, nextNo: n };
}

module.exports = { raiseDefects };
