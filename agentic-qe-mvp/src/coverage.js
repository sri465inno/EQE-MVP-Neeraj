'use strict';

function computeCoverage(requirements, testCases, results = []) {
  const resByKey = new Map(results.map((r) => [r.key, r]));
  const rows = requirements.map((req) => {
    const cases = testCases.filter((t) => t.requirementId === req.id);
    const automated = cases.filter((t) => t.automation === 'Automated');
    const executed = cases.filter((t) => ['passed', 'failed'].includes(resByKey.get(t.key)?.status));
    const failed = executed.filter((t) => resByKey.get(t.key).status === 'failed');
    let status;
    if (!cases.length) status = 'not covered';
    else if (!executed.length) status = automated.length ? 'automated, not executed' : 'designed only (manual)';
    else status = failed.length ? 'executed - failing' : 'executed - passing';
    return { requirementId: req.id, text: req.text, cases: cases.length, automated: automated.length, executed: executed.length, failed: failed.length, status };
  });
  const pct = (n) => (requirements.length ? Math.round((n / requirements.length) * 1000) / 10 : 0);
  return {
    rows,
    totals: {
      requirements: requirements.length,
      designed: rows.filter((r) => r.cases > 0).length,
      automated: rows.filter((r) => r.automated > 0).length,
      executed: rows.filter((r) => r.executed > 0).length,
      passing: rows.filter((r) => r.status === 'executed - passing').length,
    },
    percent: {
      designed: pct(rows.filter((r) => r.cases > 0).length),
      automated: pct(rows.filter((r) => r.automated > 0).length),
      executed: pct(rows.filter((r) => r.executed > 0).length),
      passing: pct(rows.filter((r) => r.status === 'executed - passing').length),
    },
  };
}

module.exports = { computeCoverage };
