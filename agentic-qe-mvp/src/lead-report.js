'use strict';
// QE lead report: the cycle written up the way a senior QE lead would, computed from the persisted cycle and its report.
const { esc, table } = require('./report');

const SOURCE_TEXT = { live: 'Jira (live call)', github: 'pulled from GitHub', fixture: 'recorded fixture', pasted: 'pasted by the user' };
const date = (iso) => (iso ? new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '-');
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function recommendation(r, defects) {
  const gap = (r.testing?.selection?.gaps || []).find((g) => g.severity === 'high');
  if (!r.execution.executed) return { decision: 'Not ready', tone: 'bad', reason: gap ? gap.message : 'The tests have not been executed yet.', conditions: gap ? [gap.message] : [] };
  const blocking = defects.filter((d) => d.blocksRelease);
  if (blocking.length) {
    return { decision: 'No-go', tone: 'bad', reason: `${plural(blocking.length, 'release-blocking defect')} open (${blocking.map((d) => d.id).join(', ')}).`,
      conditions: blocking.map((d) => `Fix ${d.id} and re-run ${d.testCaseKey}; it must pass before release.`) };
  }
  const gaps = (r.coverage?.rows || []).filter((x) => !/passing/.test(x.status));
  if (defects.length || gaps.length || r.handoverStatus === 'incomplete') {
    return { decision: 'Conditional go', tone: 'warn', reason: 'No release-blocking defects, but there are open items to accept or close.',
      conditions: [...defects.map((d) => `Accept or fix ${d.id} (${d.severity}).`), ...(gaps.length ? [`Cover or accept ${plural(gaps.length, 'requirement')} not yet verified by a passing test.`] : [])] };
  }
  return { decision: 'Go', tone: 'ok', reason: 'Every automated test passed and every requirement is verified.', conditions: [] };
}

function buildLeadReport(cycle) {
  const r = cycle.report;
  if (!r) return null;
  const a = cycle.artifacts;
  const defects = a.defects || [];
  const ex = r.execution.executed ? r.execution.summary : null;
  const n = r.normalisation;
  const rec = recommendation(r, defects);
  const reviewApproval = r.approvals.find((x) => x.gate === 'Requirement set review');
  const mergeApproval = r.approvals.find((x) => x.gate === 'Merge into baseline');
  const conflicts = a.requirements.filter((q) => q.resolution && q.resolution.chosen && (q.changedInCycle || q.introducedInCycle || cycle.id) === cycle.id);
  const enhanced = r.requirements.list.filter((q) => q.previous);
  const manual = r.automation.notAutomated;
  const gaps = (r.coverage?.rows || []).filter((x) => !/passing/.test(x.status));
  const isInc = cycle.type === 'incremental';
  const tt = r.testing;
  const sel = tt?.selection;
  const ra = r.reviewAgent;

  const summary = [
    `${isInc ? 'Incremental' : 'Baseline'} cycle for <b>${esc(r.platform?.capability || cycle.name)}</b> on build <code>${esc(r.cycle.sutBuild)}</code>, ${esc(date(r.cycle.createdAt))}.`,
    ...(tt ? [`Type of testing: <b>${esc(tt.name)}</b>. ${esc(tt.focus)}${sel && sel.notInRun ? ` This run executed ${plural(sel.inRun, 'case')} of the ${sel.designed} in the pack.` : ''}`] : []),
    `We took ${plural(r.inputs.length, 'input')} (${r.inputs.map((i) => `${esc(i.label)} ${esc(i.ref)}`).join(', ')}) and produced ${plural(r.requirements.total, 'requirement')}, ${plural(r.testCases.total, 'test case')} and ${plural(r.scripts.total, 'automated script')}.`,
    ex ? `We ran ${plural(ex.executed, 'automated test')} for real: <b>${ex.passed} passed, ${ex.failed} failed</b> (pass rate ${ex.passRate}%). ${ex.notRun ? `${plural(ex.notRun, 'manual test')} still to be run by hand.` : ''}` : 'Tests have not been executed yet.',
    defects.length ? `${plural(defects.length, 'defect')} raised from real failures, ${defects.filter((d) => d.blocksRelease).length} release-blocking: ${defects.map((d) => `${esc(d.id)} ${esc(d.title)}`).join('; ')}.` : 'No defects: nothing failed.',
    ...(isInc && r.delta ? [`Against the baseline: ${esc(r.delta.summary)}. ${r.reuse.carriedOver} of ${r.reuse.total} test cases were reused unchanged; only new and changed items were redesigned.`] : []),
  ];

  const inputs = r.inputs.map((i) => ({ label: i.label, ref: i.ref, summary: i.summary, statements: i.statements, source: SOURCE_TEXT[i.provenance] || i.provenance, files: i.files }));

  const approach = [
    `Read ${n.statements} statements from the inputs and lined them up into ${n.groups} requirement groups: ${n.agreed} agreed by every source, ${n['jira-only'] || 0} only in Jira, ${n['code-only'] || 0} only in the code, ${n.conflict || 0} in conflict.`,
    ...(ra ? [`The review agent read the inputs first and suggested ${ra.counts.added} addition(s), ${ra.counts.missing} missing piece(s) and ${ra.counts.conflicts} conflict(s) for the reviewer (${ra.counts.high} high severity). It approved nothing.`] : []),
    reviewApproval ? `${esc(reviewApproval.by)} reviewed and approved the requirement set on ${esc(date(reviewApproval.at))}${conflicts.length ? `, settling ${plural(conflicts.length, 'conflict')}: ${conflicts.map((q) => `${esc(q.title)} - kept "${esc(q.resolution.chosen.text)}" (${esc(q.resolution.chosen.sources.join('/'))}) over "${esc(q.resolution.rejected.map((x) => x.text).join('; '))}" (${esc(q.resolution.rejected.flatMap((x) => x.sources).join('/'))})`).join('; ')}` : ''}.` : 'The requirement set has not been reviewed yet.',
    ...(isInc && r.delta ? [`Compared every statement with baseline ${esc(r.cycle.baselineId)} v${esc(r.cycle.baselineVersionAtStart)}: ${esc(r.delta.summary)}.${enhanced.length ? ` Changed: ${enhanced.map((q) => `${esc(q.id)} "${esc(q.previous)}" → "${esc(q.text)}"`).join('; ')}.` : ''}`] : []),
    ...(tt ? [`${esc(tt.name)} steered the design: ${esc(tt.approach)}${sel ? ` Result: ${sel.inRun} case(s) in this run (${sel.reused} reused, ${sel.redesigned} re-designed, ${sel.added} new)${sel.notInRun ? `, ${sel.notInRun} kept in the pack outside this run` : ''}.` : ''}`] : []),
    `Derived ${plural(r.rules.total, 'business rule')} (each quoting its source), designed ${plural(r.testCases.total, 'test case')} (${Object.entries(r.testCases.byType).map(([k, v]) => `${v} ${k}`).join(', ')}) and generated ${plural(r.scripts.total, 'Playwright script')}.`,
    ...(mergeApproval ? [`${esc(mergeApproval.by)} ${esc(mergeApproval.decision)} the merge into the baseline on ${esc(date(mergeApproval.at))}.`] : []),
    ex ? `Executed the automated suite with ${esc(r.execution.tool)} against ${esc(r.execution.sut.name)}; defects were raised only for tests that actually failed.` : 'Execution has not run.',
  ];

  const artifacts = [
    { name: 'Inputs and provenance', count: r.inputs.length, note: 'what was taken from each source, and where from', tab: 'inputs', file: '01-inputs/' },
    ...(ra ? [{ name: 'Review agent suggestions', count: ra.findings.length, note: `${ra.counts.added} added · ${ra.counts.missing} missing · ${ra.counts.conflicts} conflicts (advisory)`, tab: 'review-agent', file: '01-inputs/review-agent.json' }] : []),
    { name: 'Normalised requirement set', count: n.groups, note: `${n.agreed} agreed · ${n['jira-only'] || 0} Jira-only · ${n['code-only'] || 0} code-only · ${n.conflict || 0} conflicts`, tab: 'normalise', file: '01-inputs/normalisation.json' },
    ...(isInc && r.delta ? [{ name: 'Delta against baseline', count: (r.delta.unchanged || 0) + (r.delta.enhanced || 0) + (r.delta.new || 0), note: r.delta.summary, tab: 'delta', file: '01-inputs/delta-classification.json' }] : []),
    { name: 'Requirements repository', count: r.requirements.total, note: Object.entries(r.requirements.byStatus).map(([k, v]) => `${v} ${k}`).join(' · '), tab: 'requirements', file: '02-requirements/' },
    { name: 'Business rules', count: r.rules.total, note: `${r.rules.executable} executable, each with a source quote`, tab: 'rules', file: '03-business-rules/' },
    { name: 'Test cases (Excel, Zephyr Scale format)', count: r.testCases.total, note: Object.entries(r.testCases.byAutomation).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(' · '), tab: 'testcases', file: '04-test-cases/' },
    ...(r.testData ? [{ name: 'Test data (one data set per test case)', count: r.testData.total, note: `${r.testData.conforming} conform to ${r.testData.dictionary.name} v${r.testData.dictionary.version} (${r.testData.dictionary.attributeCount} attributes) · ${r.testData.negative} negative test${r.testData.negative === 1 ? "" : "s"}${r.testData.nonConforming ? ` · ${r.testData.nonConforming} do not conform` : ''}`, tab: 'testdata', file: '05-test-data/' }] : []),
    { name: 'Automation scripts (Playwright)', count: r.scripts.total, note: Object.entries(r.scripts.byStatus).map(([k, v]) => `${v} ${k}`).join(' · '), tab: 'scripts', file: '06-automation-scripts/' },
    ...(mergeApproval ? [{ name: 'Merge approval', count: 1, note: `${mergeApproval.decision} by ${mergeApproval.by}`, tab: 'merge', file: '10-merge-approval/' }] : []),
    { name: 'Execution results and evidence', count: ex ? ex.executed : 0, note: ex ? `${ex.passed} passed · ${ex.failed} failed · ${ex.notRun} manual` : 'not executed', tab: 'execution', file: '07-execution/' },
    { name: 'Defects', count: defects.length, note: defects.length ? defects.map((d) => `${d.id} ${d.severity}`).join(' · ') : 'none', tab: 'defects', file: '08-defects/' },
    { name: 'Cycle report (HTML, Excel)', count: 1, note: 'full detail behind this summary', tab: 'report', file: '09-report/' },
  ];

  const risks = [
    ...(sel ? sel.gaps.map((g) => `${tt.name}: ${g.message}`) : []),
    ...(sel && sel.outOfScope.length ? [`${plural(sel.outOfScope.length, 'requirement')} had no case in this ${tt.name.toLowerCase()} run (${sel.outOfScope.join(', ')}); a ${String(tt.id).split('+').includes('smoke') ? 'passing smoke run is not a release decision' : 'wider run is needed before release'}.`] : []),
    ...(ra ? ra.findings.filter((f) => f.severity === 'high' && f.category === 'missing').map((f) => `Review agent (${f.id}): ${f.title}. ${f.suggestion}`) : []),
    ...defects.map((d) => `${d.id} (${d.severity}): ${d.impact || d.title}. Expected ${d.expected}, got ${d.actual}. ${d.releaseDecision || ''}`),
    ...(manual.length ? [`${plural(manual.length, 'test case')} cannot be automated and ${manual.length === 1 ? 'was' : 'were'} not executed: ${manual.map((t) => `${t.key} ${t.name}`).join('; ')}. Needs a manual run before sign-off.`] : []),
    ...(gaps.length ? [`${plural(gaps.length, 'requirement')} not yet verified by a passing test: ${gaps.map((g) => `${g.requirementId} (${g.status})`).join('; ')}.`] : []),
    ...(conflicts.length ? [`${plural(conflicts.length, 'conflict')} between Jira and the code ${conflicts.length === 1 ? 'was' : 'were'} settled by the reviewer; the losing source (${[...new Set(conflicts.flatMap((q) => q.resolution.rejected.flatMap((x) => x.sources)))].join('/')}) should be corrected so they agree.`] : []),
    ...((n['jira-only'] || n['code-only']) ? [`${(n['jira-only'] || 0) + (n['code-only'] || 0)} requirement groups come from a single source only; the product owner should confirm them.`] : []),
    ...(r.handoverStatus === 'incomplete' ? ['At least one agent did not hand over every artifact its skills require; see Skills and hand-overs.'] : []),
  ];

  const nextSteps = [
    ...(rec.conditions || []),
    ...(manual.length ? [`Run ${manual.map((t) => t.key).join(', ')} manually and record the result.`] : []),
    ...(conflicts.length ? ['Update the losing source (Jira or code) so both state the reviewed value.'] : []),
    isInc ? 'Keep the updated baseline as the reference for the next release.' : 'Use this approved baseline as the reference for the next incremental cycle.',
  ];

  const kpis = [
    ...(tt ? [['Type of testing', tt.name]] : []), ['Requirements', r.requirements.total], ['Test cases', r.testCases.total], ['Automated', r.automation.casesCovered],
    ['Pass rate', ex ? `${ex.passRate}%` : 'n/a'], ['Defects', defects.length], ['Requirements verified', r.coverage ? `${r.coverage.percent.passing}%` : 'n/a'],
  ];

  return {
    title: `QE lead report - ${cycle.name}`, cycleId: cycle.id, cycleType: cycle.type, preparedBy: 'Agentic QE Platform (QE lead report, computed from the cycle)',
    generatedAt: r.generatedAt, recommendation: rec, kpis, summary, inputs, approach, artifacts, risks, nextSteps,
    coverageNote: r.coverage?.attributes ? `${r.coverage.attributes.exercised} of ${r.coverage.attributes.driverCount} ${r.platform?.driversLabel || 'commission-driving attributes'} (out of ${r.coverage.attributes.attributeCount} ${r.platform?.modelLabel || 'reservation'} attributes) are varied by at least one test.` : null,
    signoff: r.approvals.map((x) => ({ gate: x.gate, decision: x.decision, by: x.by, at: x.at, detail: x.detail })),
  };
}

function renderLeadHtml(L, { cycleLink = null } = {}) {
  if (!L) return '';
  const rec = L.recommendation;
  const link = (x) => (cycleLink ? `<a href="${cycleLink(x.tab)}">${esc(x.name)}</a>` : esc(x.name));
  return `<div class="lead">
<div class="lead-rec ${esc(rec.tone)}"><span class="lead-decision">${esc(rec.decision)}</span><span>${esc(rec.reason)}</span></div>
<div class="kpis">${L.kpis.map(([k, v]) => `<div class="kpi">${esc(k)}<b>${esc(v)}</b></div>`).join('')}</div>
<h3>1. Summary</h3><ul>${L.summary.map((s) => `<li>${s}</li>`).join('')}</ul>
<h3>2. Inputs taken</h3>${table(['Input', 'Reference', 'What we took from it', 'Source'], L.inputs.map((i) => [esc(i.label), esc(i.ref), `${esc(i.summary || '')}${i.summary ? '<br>' : ''}<span class="muted">${esc(i.statements)} statements</span>`, esc(i.source)]))}
<h3>3. How we ran the cycle</h3><ol>${L.approach.map((s) => `<li>${s}</li>`).join('')}</ol>
<h3>4. Artifacts produced</h3>${table(['Artifact', 'Count', 'Notes'], L.artifacts.map((x) => [link(x), esc(x.count), esc(x.note)]))}
<h3>5. Risks and open items</h3>${L.risks.length ? `<ul>${L.risks.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : '<p>None.</p>'}${L.coverageNote ? `<p class="muted">${esc(L.coverageNote)}</p>` : ''}
<h3>6. Recommendation and next steps</h3><p><b>${esc(rec.decision)}.</b> ${esc(rec.reason)}</p><ul>${L.nextSteps.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
<h3>7. Sign-off</h3>${table(['Gate', 'Decision', 'By', 'When', 'Detail'], L.signoff.map((x) => [esc(x.gate), esc(x.decision), esc(x.by), esc(date(x.at)), esc(x.detail || '')]))}
<p class="muted small">${esc(L.preparedBy)} · generated ${esc(date(L.generatedAt))}. Every figure comes from the persisted cycle; nothing is estimated.</p>
</div>`;
}

const LEAD_CSS = `.lead-rec{display:flex;gap:14px;align-items:center;border-radius:8px;padding:12px 16px;margin:10px 0 14px;border:1px solid #d9e0ea;background:#f4f7fb}
.lead-rec.bad{border-color:#e7b4b0;background:#fbeeed}.lead-rec.warn{border-color:#ecd49a;background:#fdf6e6}.lead-rec.ok{border-color:#a9d7b9;background:#ecf7f0}
.lead-decision{font-weight:700;font-size:18px;white-space:nowrap}.lead h3{color:#123a73;margin-top:22px}.lead li{margin:4px 0;line-height:1.45}`;

function renderLeadPage(L) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(L.title)}</title><style>body{font-family:Segoe UI,system-ui,sans-serif;color:#1d2433;max-width:1100px;margin:24px auto;padding:0 16px}h1{color:#123a73}
table{border-collapse:collapse;width:100%;font-size:13px;margin:8px 0}th,td{border:1px solid #d9e0ea;padding:5px 7px;text-align:left;vertical-align:top}th{background:#eef3fa}
.kpis{display:flex;gap:12px;flex-wrap:wrap}.kpi{background:#f4f7fb;border:1px solid #dde5f0;border-radius:8px;padding:10px 14px;min-width:120px}.kpi b{display:block;font-size:22px}.muted{color:#5b6475}.small{font-size:12px}${LEAD_CSS}</style></head>
<body><h1>${esc(L.title)}</h1><p class="muted">${esc(L.cycleId)} · ${esc(L.cycleType)} cycle</p>${renderLeadHtml(L)}</body></html>`;
}

const strip = (s) => String(s).replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const md = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const mdTable = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(md).join(' | ')} |`)].join('\n');

function renderLeadMarkdown(L) {
  const rec = L.recommendation;
  return [`# ${L.title}`, '', `${L.cycleId} · ${L.cycleType} cycle`, '', `> **Recommendation: ${rec.decision}.** ${rec.reason}`, '',
    mdTable(L.kpis.map(([k]) => k), [L.kpis.map(([, v]) => v)]), '',
    '## 1. Summary', ...L.summary.map((s) => `- ${strip(s)}`), '',
    '## 2. Inputs taken', mdTable(['Input', 'Reference', 'What we took from it', 'Source'], L.inputs.map((i) => [i.label, i.ref, `${i.summary ? `${i.summary}; ` : ''}${i.statements} statements`, i.source])), '',
    '## 3. How we ran the cycle', ...L.approach.map((s, i) => `${i + 1}. ${strip(s)}`), '',
    '## 4. Artifacts produced', mdTable(['Artifact', 'Count', 'Notes', 'Folder'], L.artifacts.map((x) => [x.name, x.count, x.note, `[${x.file}](${x.file})`])), '',
    '## 5. Risks and open items', ...(L.risks.length ? L.risks.map((s) => `- ${s}`) : ['None.']), ...(L.coverageNote ? ['', `_${L.coverageNote}_`] : []), '',
    '## 6. Recommendation and next steps', `**${rec.decision}.** ${rec.reason}`, '', ...L.nextSteps.map((s) => `- ${s}`), '',
    '## 7. Sign-off', mdTable(['Gate', 'Decision', 'By', 'When', 'Detail'], L.signoff.map((x) => [x.gate, x.decision, x.by, date(x.at), x.detail || ''])), '',
    `_${L.preparedBy} · generated ${date(L.generatedAt)}. Every figure comes from the persisted cycle; nothing is estimated._`, ''].join('\n');
}

module.exports = { buildLeadReport, renderLeadHtml, renderLeadPage, renderLeadMarkdown, LEAD_CSS };
