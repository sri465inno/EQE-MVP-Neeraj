'use strict';
// Reporting agent: raises defects for failures, builds requirement traceability and applies the release criteria.
const fs = require('fs');
const path = require('path');
const jira = require('../jira');
const { ROOT, runDir } = require('../store');

const SEVERITY = { Highest: 'Critical', High: 'High', Medium: 'Medium', Low: 'Low', Lowest: 'Low' };
const PRI_RANK = ['Lowest', 'Low', 'Medium', 'High', 'Highest'];

module.exports = async function reporting(run, { log }) {
  const criteria = JSON.parse(fs.readFileSync(path.join(ROOT, 'dashboard', 'config', 'release-criteria.json'), 'utf8'));
  const stories = run.requirements.stories;
  const storyOf = Object.fromEntries(stories.map((s) => [s.key, s]));
  const tcOf = Object.fromEntries(run.testCases.map((t) => [t.id, t]));
  const resOf = Object.fromEntries((run.execution?.results || []).map((r) => [r.tcId, r]));
  const scriptOf = Object.fromEntries((run.scripts?.cases || []).map((c) => [c.tcId, c]));
  const excluded = run.review?.excluded || [];
  // Execution review decisions: which failures become Jira defects, and the reviewer's manual results.
  const xr = run.execReview || { defects: [], manual: [] };
  const decisionOf = Object.fromEntries((xr.defects || []).map((d) => [d.tcId, d]));
  const manualOf = Object.fromEntries((xr.manual || []).map((m) => [m.tcId, m]));
  const verified = (id) => ['passed', 'failed'].includes(manualOf[id]?.status);

  // Defects (a re-run reuses the Jira bug already raised for the same test case)
  const previous = Object.fromEntries((run.report?.defects || []).filter((d) => d.jiraKey).map((d) => [d.tcId, d.jiraKey]));
  const defects = []; const notRaised = []; let seq = 0;
  const failures = [...run.execution.results.filter((x) => x.status === 'failed').map((x) => ({ ...x, source: 'automation' })),
    ...(xr.manual || []).filter((m) => m.status === 'failed' && m.raiseDefect).map((m) => ({ tcId: m.tcId, source: 'manual', failedStep: 'Manual execution recorded at the execution review', error: m.comment || 'Marked failed by the reviewer' }))];
  for (const r of failures) {
    const tc = tcOf[r.tcId];
    const dec = r.source === 'automation' ? decisionOf[r.tcId] : null;
    const pri = tc.storyKeys.map((k) => storyOf[k]?.priority).sort((a, b) => PRI_RANK.indexOf(b) - PRI_RANK.indexOf(a))[0] || 'Medium';
    const failingAcs = tc.acIds.filter((id) => run.analysis.stories.flatMap((s) => s.acs).find((a) => a.id === id));
    const d = {
      tcId: tc.id, storyKeys: tc.storyKeys, acIds: failingAcs, severity: SEVERITY[pri] || 'Medium', priority: pri,
      title: `${tc.title} fails at "${(r.failedStep || 'unknown step').replace(/^\d+\.\s*/, '')}"`,
      expected: r.failedStep, actual: (r.error || '').split('\n').filter(Boolean).slice(0, 3).join(' · '), screenshot: r.screenshot, trace: r.trace, source: r.source,
    };
    const ai = (run.aiDefects || []).find((x) => x.tcId === tc.id);
    if (ai) Object.assign(d, { title: ai.title, ai });
    d.id = `DEF-${++seq}`;
    if (dec && dec.raise === false) {
      Object.assign(d, { notRaised: true, reason: dec.reason, decidedBy: xr.approvedBy });
      log(`${tc.id} failed → not raised in Jira (execution review by ${xr.approvedBy}${dec.reason ? `: ${dec.reason}` : ''})`, 'warn');
      notRaised.push(d); continue;
    }
    if (previous[tc.id]) {
      d.jiraKey = previous[tc.id];
      try { await jira.comment(d.jiraKey, `EQE dashboard ${run.id}: ${tc.id} still fails on re-run (${new Date().toLocaleString()}).`); } catch { /* comment is best effort */ }
      log(`${tc.id} still failing → existing ${d.jiraKey} updated`, 'warn');
    } else if (run.config.raiseDefects !== false) {
      try {
        const steps = tc.steps.map((s) => `${s.n}. ${s.action}${s.expected ? ` → ${s.expected}` : ''}`).join('\n\n');
        const created = await jira.createIssue({
          project: { key: 'EQE' }, issuetype: { name: 'Bug' }, summary: d.title, priority: { name: pri }, labels: ['eqe-dashboard', 'automation', run.id],
          description: ai
            ? [`Found by the EQE dashboard (${run.id}) while running ${tc.id}. Written by the Devin session ${run.devin?.url || ''}.`, ai.summary, `Requirements: ${(ai.acIds?.length ? ai.acIds : tc.acIds).join(', ')}`,
              `Steps to reproduce:\n\n${(ai.stepsToReproduce?.length ? ai.stepsToReproduce.map((x, i) => `${i + 1}. ${x}`) : [steps]).join('\n\n')}`, `Expected: ${ai.expected || r.failedStep}`, `Actual: ${ai.actual || d.actual}`, ai.rootCause ? `Likely root cause: ${ai.rootCause}` : ''].filter(Boolean).join('\n\n')
            : `Found by the EQE dashboard (${run.id}) while running ${tc.id} against ${run.config.appUrl}.\n\nRequirements: ${tc.acIds.join(', ')}\n\nFailed step: ${r.failedStep}\n\nActual: ${d.actual}\n\nSteps to reproduce:\n\n${steps}`,
          customfield_10300: tc.storyKeys.join(','),
        });
        d.jiraKey = created.key;
        for (const k of tc.storyKeys) await jira.comment(k, `EQE dashboard ${run.id}: ${tc.id} failed. Defect ${created.key} raised (${d.severity}).`);
        log(`${tc.id} failed → raised ${created.key} (${d.severity}) linked to ${tc.storyKeys.join(', ')}`, 'warn');
      } catch (e) { log(`Could not raise Jira bug for ${tc.id}: ${e.message}`, 'warn'); }
    } else log(`${tc.id} failed → ${d.id} (${d.severity}); Jira bug not raised (run option)`, 'warn');
    defects.push(d);
  }

  // Traceability: AC → test cases → scripts → results → defects
  const resultOf = (t) => resOf[t.id]?.status || (verified(t.id) ? manualOf[t.id].status : undefined);
  const acStatus = (tcs) => {
    const auto = tcs.filter((t) => !excluded.includes(t.id) && (t.automation === 'Automation' || verified(t.id)));
    if (!tcs.length) return 'Not covered';
    if (auto.some((t) => resultOf(t) === 'failed')) return 'Failed';
    if (auto.length && auto.every((t) => resultOf(t) === 'passed')) return 'Passed';
    if (!auto.length) return 'Manual';
    return 'Not run';
  };
  const trace = run.analysis.stories.flatMap((s) => s.acs.map((a) => {
    const tcs = run.testCases.filter((t) => t.acIds.includes(a.id));
    return {
      storyKey: s.key, storySummary: s.summary, acId: a.id, acText: a.text, testability: a.testability,
      tests: tcs.map((t) => ({ id: t.id, title: t.title, automation: excluded.includes(t.id) ? 'Excluded' : t.automation, script: scriptOf[t.id]?.file || null, result: resOf[t.id]?.status || (verified(t.id) ? manualOf[t.id].status : t.automation === 'Manual' ? 'manual' : 'not run') })),
      defects: defects.filter((d) => d.acIds.includes(a.id) || (d.tcId && tcs.some((t) => t.id === d.tcId))).map((d) => d.jiraKey || d.id),
      status: (run.design.outOfScope || []).includes(a.id) ? 'Out of scope' : acStatus(tcs),
    };
  }));
  const storyStatus = stories.map((s) => {
    const rows = trace.filter((r) => r.storyKey === s.key && r.status !== 'Out of scope');
    const st = rows.some((r) => r.status === 'Failed') ? 'Failed' : rows.every((r) => r.status === 'Passed') ? 'Passed' : rows.some((r) => r.status === 'Passed') ? 'Passed with manual checks' : 'Not verified';
    return { key: s.key, summary: s.summary, priority: s.priority, epicKey: s.epicKey, status: st, acs: rows.length, passed: rows.filter((r) => r.status === 'Passed').length, failed: rows.filter((r) => r.status === 'Failed').length, manual: rows.filter((r) => r.status === 'Manual').length };
  });

  // Release decision
  const e = run.execution;
  const mCount = (k) => (xr.manual || []).filter((m) => m.status === k).length;
  const passed = e.passed + mCount('passed'); const failed = e.failed + mCount('failed'); const executed = passed + failed;
  const passRate = executed ? Math.round((passed / executed) * 1000) / 10 : 0;
  const acCoverage = run.design.acCoverage;
  const acAutomatedPassed = trace.filter((r) => r.status === 'Passed').length;
  const reasons = [];
  let decision = 'Go';
  const noGo = defects.filter((d) => criteria.noGoSeverities.includes(d.severity));
  const cond = defects.filter((d) => criteria.conditionalSeverities.includes(d.severity));
  if (noGo.length) { decision = 'No-go'; reasons.push(`${noGo.length} ${criteria.noGoSeverities.join('/')} defect(s) open`); }
  if (passRate < criteria.minAutomationPassRate) { decision = 'No-go'; reasons.push(`Pass rate ${passRate}% is below ${criteria.minAutomationPassRate}%`); }
  if (acCoverage < criteria.minAcceptanceCriteriaCoverage) { decision = decision === 'Go' ? 'Conditional' : decision; reasons.push(`AC coverage ${acCoverage}% is below ${criteria.minAcceptanceCriteriaCoverage}%`); }
  if (cond.length) { decision = decision === 'Go' ? 'Conditional' : decision; reasons.push(`${cond.length} ${criteria.conditionalSeverities.join('/')} defect(s) open`); }
  const manual = trace.filter((r) => r.status === 'Manual').length;
  if (manual) reasons.push(`${manual} acceptance criteria need manual verification or clarification`);
  if (notRaised.length) reasons.push(`${notRaised.length} failed test(s) not raised as defects by the reviewer (${notRaised.map((d) => d.tcId).join(', ')})`);
  if (mCount('passed') + mCount('failed')) reasons.push(`Manual results recorded by the reviewer: ${mCount('passed')} passed, ${mCount('failed')} failed, ${mCount('not run')} not run`);
  if (decision === 'Go') reasons.unshift('All release criteria met');

  let release = null;
  try { release = (await (await fetch(run.config.appUrl.replace(/\/$/, '') + '/api/health')).json()).release; } catch { /* app unreachable */ }
  run.report = {
    generatedAt: new Date().toISOString(), release, criteria, decision, reasons, signOffOwner: criteria.signOffOwner,
    metrics: { stories: stories.length, acs: trace.length, testCases: run.testCases.length, automated: e.results.length, executed, passed, failed, skipped: e.skipped, passRate, acCoverage, acAutomatedPassed, defects: defects.length, mcpCalls: run.scripts.mcpCalls, durationMs: e.durationMs,
      automatedPassed: e.passed, automatedFailed: e.failed, manualPassed: mCount('passed'), manualFailed: mCount('failed'), manualNotRun: mCount('not run'), notRaised: notRaised.length },
    defects, notRaised, manualResults: xr.manual || [], execReview: { approvedBy: xr.approvedBy, approvedAt: xr.approvedAt, note: xr.note }, trace, storyStatus,
  };
  const md = [
    `# EQE test summary · ${run.id}`, '', `Application: StayEase${release ? ` release ${release}` : ''} (${run.config.appUrl}) · Requirements: ${run.config.initiative} (${run.requirements.source})`, '',
    `## Release decision: ${decision}`, ...reasons.map((r) => `- ${r}`), `\nSign-off: ${criteria.signOffOwner}`, '',
    '## Metrics', `| Stories | AC | Test cases | Automated | Passed | Failed | Pass rate | AC coverage | Defects |`, '|---|---|---|---|---|---|---|---|---|',
    `| ${stories.length} | ${trace.length} | ${run.testCases.length} | ${e.results.length} | ${passed} | ${failed} | ${passRate}% | ${acCoverage}% | ${defects.length} |`, '',
    '## Defects', ...(defects.length ? defects.map((d) => `- **${d.jiraKey || d.id}** (${d.severity}) ${d.title}. Stories: ${d.storyKeys.join(', ')}. Actual: ${d.actual}`) : ['None']), '',
    ...(notRaised.length ? ['## Failures not raised as defects (execution review)', ...notRaised.map((d) => `- ${d.tcId}: ${d.title}${d.reason ? `. Reason: ${d.reason}` : ''} (${d.decidedBy})`), ''] : []),
    ...((xr.manual || []).length ? ['## Manual test results (execution review)', ...(xr.manual || []).map((m) => `- ${m.tcId}: ${m.status}${m.comment ? `. ${m.comment}` : ''}`), ''] : []),
    '## Traceability', '| Story | AC | Test cases | Result | Defects |', '|---|---|---|---|---|',
    ...trace.map((r) => `| ${r.storyKey} | ${r.acId} | ${r.tests.map((t) => `${t.id} (${t.result})`).join(', ') || '-'} | ${r.status} | ${r.defects.join(', ') || '-'} |`), '',
  ].join('\n');
  fs.writeFileSync(path.join(runDir(run.id), 'test-summary.md'), md);
  return `${decision} · pass rate ${passRate}% · AC coverage ${acCoverage}% · ${defects.length} defect(s)`;
};
