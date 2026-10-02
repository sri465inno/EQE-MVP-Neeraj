'use strict';
const { getTestingType } = require('./testing-types');
const { PLATFORM_AGENTS, INPUT_TYPES } = require('./platform');
const { domainOf } = require('./agents/domains');
// Cycle report: every figure is computed here from persisted artifacts; the model (optional) drafts the narrative only.
const { draftNarrative } = require('./llm');

const APP_TITLE = 'Agentic QE Platform - MVP';

const countBy = (arr, fn) => arr.reduce((acc, x) => {
  const keys = [].concat(fn(x));
  for (const k of keys) acc[k] = (acc[k] || 0) + 1;
  return acc;
}, {});

/** Per-phase hand-over results, in phase order. */
function collectHandovers(cycle) {
  return cycle.phases.filter((p) => p.handover).map((p) => ({
    phase: p.name, label: p.label, status: p.handover.status, skills: p.skills || [], missing: p.handover.missing,
    items: p.handover.items.map((i) => ({ key: i.key, status: i.status, count: i.count, skills: i.skills, note: i.note })),
  }));
}

const PROVENANCE = { live: 'live Jira call', github: 'pulled live from GitHub', 'jira-export': 'Jira export on GitHub', fixture: 'recorded fixture', pasted: 'pasted' };
const provKind = (p) => (p.kind === 'github' && p.system === 'jira' ? 'jira-export' : p.kind);

async function buildCycleReport(cycle, { env = process.env, fetchImpl, guidance = '' } = {}) {
  const a = cycle.artifacts;
  const exec = a.execution || null;
  const defects = a.defects || [];
  const dom = domainOf(cycle);
  const tt = getTestingType(cycle.testingType, dom.id);
  const facts = {
    cycleName: cycle.name,
    cycleType: cycle.type,
  testingType: tt.name,
    inputs: cycle.inputs.map((i) => `${i.label} ${i.ref} (${PROVENANCE[provKind(i.provenance)] || i.provenance.kind})`).join(', '),
    requirements: a.requirements.length,
    delta: cycle.delta ? cycle.delta.summary : null,
    testCases: a.testCases.length,
    automated: a.testCases.filter((t) => t.automation === 'Automated').length,
    scripts: a.scripts.length,
    executed: exec ? exec.summary.executed : 0,
    passed: exec ? exec.summary.passed : 0,
    failed: exec ? exec.summary.failed : 0,
    passRate: exec ? exec.summary.passRate : 0,
    defects: defects.length,
    defectTitles: defects.map((d) => `${d.id} ${d.title}`).join('; '),
  };
  const narrative = await draftNarrative(facts, { env, fetchImpl, guidance });
  const carried = a.testCases.filter((t) => t.status === 'carried over').length;
  const manual = a.testCases.filter((t) => t.automation !== 'Automated');
  const handovers = collectHandovers(cycle);
  return {
    title: `${APP_TITLE} - Cycle report`,
    generatedAt: new Date().toISOString(),
    cycle: {
      id: cycle.id, name: cycle.name, type: cycle.type, testingType: tt.id, testingTypeName: tt.name, status: cycle.status, createdAt: cycle.createdAt, completedAt: cycle.completedAt || null,
      baselineId: cycle.baselineId, baselineVersionAtStart: cycle.baselineVersionAtStart, baselineVersionAfter: cycle.baselineVersionAfter ?? null,
      sutBuild: cycle.sutBuild, ranBy: cycle.createdBy || null,
    },
    platform: {
      agents: PLATFORM_AGENTS.map((g) => ({ ...g, status: g.id === 'report' ? 'producing this report' : (cycle.phases.find((p) => p.name === g.id) || {}).status || 'not in this cycle' })),
      inputsImplemented: INPUT_TYPES.filter((t) => t.mvp !== 'platform only').map((t) => `${t.name} (${t.mvp})`),
      inputsPlatformOnly: INPUT_TYPES.filter((t) => t.mvp === 'platform only').map((t) => t.name),
      capability: dom.capability, modelLabel: dom.modelLabel, driversLabel: dom.driversLabel,
    },
    testing: {
      id: tt.id, ids: tt.ids, name: tt.name, focus: tt.focus, approach: cycle.type === 'incremental' ? tt.incremental : tt.baseline,
      selection: a.selection || null,
    },
    reviewAgent: cycle.reviewAgent ? { counts: cycle.reviewAgent.counts, note: cycle.reviewAgent.note, findings: cycle.reviewAgent.findings } : null,
    dataModel: (cycle.inputs.find((i) => i.slot === 'codebase') || {}).dataModel || null,
    skills: (cycle.skills || []).map((k) => ({ id: k.id, name: k.name, description: k.description, file: k.file, sha256: k.sha256, appliesTo: k.appliesTo, delivers: k.delivers })),
    handovers,
    handoverStatus: handovers.some((h) => h.status === 'incomplete') ? 'incomplete' : 'complete',
    inputs: cycle.inputs.map((i) => ({ slot: i.slot, label: i.label, ref: i.ref, summary: i.summary || i.description || null, children: i.children || [], statements: i.statementCount,
      provenance: provKind(i.provenance), provenanceLabel: i.provenance.label, files: i.provenance.files || [] })),
    normalisation: cycle.normalisation.counts,
    delta: cycle.delta ? { ...cycle.delta.counts, summary: cycle.delta.summary } : null,
    requirements: {
      total: a.requirements.length,
      byType: countBy(a.requirements, (r) => r.type),
      byStatus: countBy(a.requirements, (r) => r.status),
      bySource: countBy(a.requirements, (r) => r.bucket),
      list: a.requirements.map((r) => ({ id: r.id, text: r.text, type: r.type, status: r.status, version: r.version, previous: r.previous ? r.previous.text : null, jiraKeys: r.jiraKeys })),
    },
    rules: { total: a.rules.length, executable: a.rules.filter((r) => r.executable).length },
    testCases: {
      total: a.testCases.length,
      byType: countBy(a.testCases, (t) => t.type),
      byLabel: countBy(a.testCases, (t) => t.labels),
      byStatus: countBy(a.testCases, (t) => t.status),
      byAutomation: countBy(a.testCases, (t) => t.automation),
    },
    automation: {
      specs: a.scripts.length,
      specsChanged: a.scripts.filter((x) => x.status === 're-designed').length,
      specsNew: a.scripts.filter((x) => x.status === 'new').length,
      casesCovered: a.testCases.length - manual.length,
      notAutomated: manual.map((t) => ({ key: t.key, name: t.name, why: t.automationNote || 'Manual: no deterministic, observable check against the SUT API' })),
    },
    reuse: {
      carriedOver: cycle.type === 'incremental' ? carried : 0,
      total: a.testCases.length,
      percent: cycle.type === 'incremental' && a.testCases.length ? Math.round((carried / a.testCases.length) * 1000) / 10 : 0,
      note: 'Reuse means these artefacts were not re-designed, not that they were not executed.',
    },
    testData: a.testDataSummary ? { ...a.testDataSummary, sets: (a.testData || []).map((d) => ({ id: d.id, testCaseKey: d.testCaseKey, drivers: d.drivers.map((x) => `${x.attribute}=${x.value}`).join('; '), conformance: d.conformance, problems: d.problems, status: d.status })) } : null,
    scripts: { total: a.scripts.length, byStatus: countBy(a.scripts, (s) => s.status), files: a.scripts.map((s) => ({ file: s.file, covers: s.covers, status: s.status, version: s.version })) },
    execution: exec && exec.executed !== false ? {
      executed: true, quarantined: 'not measured', durationMs: Date.parse(exec.finishedAt) - Date.parse(exec.startedAt), tool: exec.tool, command: exec.command, sut: exec.sut, startedAt: exec.startedAt, finishedAt: exec.finishedAt, summary: exec.summary,
      results: exec.results.map((r) => ({ key: r.key, requirementId: r.requirementId, name: r.name, status: r.status, duration: r.duration, reason: r.reason || null })),
    } : { executed: false, reason: exec ? exec.tool : null },
    defects: {
      open: defects.map((d) => ({ id: d.id, title: d.title, severity: d.severity, blocksRelease: d.blocksRelease ?? null, ruleId: d.ruleId || null, movement: d.movement, testCaseKey: d.testCaseKey, requirementId: d.requirementId, expected: d.expected, actual: d.actual, assertion: d.assertion })),
      resolved: (a.resolvedDefects || []).map((d) => ({ id: d.id, title: d.title, testCaseKey: d.testCaseKey })),
      movement: countBy(defects, (d) => d.movement),
    },
    coverage: a.coverage || null,
    approvals: cycle.approvals,
    narrative,
    honesty: [
      ...cycle.inputs.map((i) => `${i.label} ${i.ref}: ${i.provenance.label}`),
      exec ? `Execution: ${exec.summary.executed} automated cases really executed by ${exec.tool} against ${exec.sut.name} (${exec.sut.build}); ${exec.summary.notRun} manual case(s) designed but not executed.` : 'Execution: not run.',
      'Normalisation, delta classification, coverage, pass/fail and defect raising are computed in code, not by a model.',
    ],
  };
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const kv = (obj) => Object.entries(obj || {}).map(([k, v]) => `${esc(k)}: <b>${esc(v)}</b>`).join(' &middot; ') || '-';
const table = (headers, rows) => `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${headers.length}">None</td></tr>`}</tbody></table>`;

const CSS = `body{font-family:Segoe UI,system-ui,sans-serif;color:#1d2433;max-width:1100px;margin:24px auto;padding:0 16px}h1{color:#123a73}h2{border-bottom:2px solid #e3e9f3;padding-bottom:4px;margin-top:28px;color:#123a73}
table{border-collapse:collapse;width:100%;font-size:13px;margin:8px 0}th,td{border:1px solid #d9e0ea;padding:5px 7px;text-align:left;vertical-align:top}th{background:#eef3fa}
.kpis{display:flex;gap:12px;flex-wrap:wrap}.kpi{background:#f4f7fb;border:1px solid #dde5f0;border-radius:8px;padding:10px 14px;min-width:120px}.kpi b{display:block;font-size:22px}
.pass{color:#11703a;font-weight:600}.fail{color:#b3261e;font-weight:600}.muted{color:#5b6475}.tag{display:inline-block;background:#eef3fa;border-radius:10px;padding:1px 8px;font-size:12px}`;

function statusCell(s) {
  return `<span class="${s === 'passed' ? 'pass' : s === 'failed' ? 'fail' : 'muted'}">${esc(s)}</span>`;
}

function renderReportHtml(r) {
  const ex = r.execution;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(r.title)} - ${esc(r.cycle.name)}</title><style>${CSS}</style></head><body>
<h1>${esc(r.title)}</h1>
<p><b>${esc(r.cycle.name)}</b> (${esc(r.cycle.id)}, ${esc(r.cycle.type)}) &middot; status ${esc(r.cycle.status)} &middot; baseline ${esc(r.cycle.baselineId || '-')} ${r.cycle.baselineVersionAfter ? `v${esc(r.cycle.baselineVersionAfter)}` : ''} &middot; SUT build <code>${esc(r.cycle.sutBuild)}</code> &middot; run by ${esc(r.cycle.ranBy || 'not recorded')} &middot; ${esc(r.cycle.createdAt)} to ${esc(r.cycle.completedAt || '-')} &middot; generated ${esc(r.generatedAt)}</p>
${r.platform ? `<h2>Platform scope</h2><p>Capability under test: <b>${esc(r.platform.capability)}</b>${r.dataModel ? ` &middot; ${esc(r.platform.modelLabel || 'reservation')} model <b>${esc(r.dataModel.attributeCount)}</b> attributes in ${esc(r.dataModel.groupCount)} groups, <b>${esc(r.dataModel.drivers.length)}</b> of them ${esc(r.platform.driversLabel || 'commission-driving attributes')} (${esc(r.dataModel.file)})` : ''}.</p>
<p>${r.platform.agents.length} platform agents: ${r.platform.agents.map((g) => `${g.no}. ${esc(g.name)} <span class="muted">(${esc(g.status)})</span>`).join(' &middot; ')}</p>
<p>Inputs implemented in this MVP: ${esc(r.platform.inputsImplemented.join('; '))}. Platform input types not in this MVP: <span class="muted">${esc(r.platform.inputsPlatformOnly.join('; '))}</span>.</p>` : ''}
<h2>Type of testing</h2>${r.testing ? `<p><b>${esc(r.testing.name)}</b>: ${esc(r.testing.focus)}<br>${esc(r.testing.approach)}</p>${r.testing.selection ? `<p>${kv({ 'cases in the pack': r.testing.selection.designed, 'in this run': r.testing.selection.inRun, reused: r.testing.selection.reused, 're-designed': r.testing.selection.redesigned, added: r.testing.selection.added, 'kept outside this run': r.testing.selection.notInRun })}</p>${r.testing.selection.gaps.length ? `<ul>${r.testing.selection.gaps.map((g) => `<li class="fail">${esc(g.message)}</li>`).join('')}</ul>` : ''}` : ''}` : ''}
<h2>Review agent suggestions</h2>${r.reviewAgent ? `<p>${kv(r.reviewAgent.counts)} &middot; <span class="muted">${esc(r.reviewAgent.note)}</span></p>${table(['ID', 'Kind', 'Severity', 'Suggestion', 'Source'], r.reviewAgent.findings.map((f) => [esc(f.id), esc(f.category), esc(f.severity), `<b>${esc(f.title)}</b><br>${esc(f.detail || '')}<br><span class="muted">${esc(f.suggestion)}</span>`, esc(f.sources.map((x) => [x.ref, x.line].filter(Boolean).join(':')).join(', '))]))}` : '<p>No review agent ran for this cycle.</p>'}
<h2>Active skills</h2>${(r.skills || []).length ? table(['Skill', 'Description', 'Seen by agents', 'Owes', 'File'], r.skills.map((k) => [`<b>${esc(k.name)}</b><br><code>${esc(k.id)}</code>`, esc(k.description), esc(k.appliesTo.join(', ')), esc(Object.entries(k.delivers).map(([ag, keys]) => `${ag}: ${keys.join(', ')}`).join('; ')), `${esc(k.file)} <span class="muted">${esc(k.sha256)}</span>`])) : '<p>No skills were active for this cycle.</p>'}
<div class="kpis">
<div class="kpi">Requirements<b>${r.requirements.total}</b></div><div class="kpi">Test cases<b>${r.testCases.total}</b></div><div class="kpi">Scripts<b>${r.scripts.total}</b></div>
<div class="kpi">Executed<b>${ex.executed ? ex.summary.executed : 0}</b></div><div class="kpi">Pass rate<b>${ex.executed ? ex.summary.passRate + '%' : 'n/a'}</b></div><div class="kpi">Defects<b>${r.defects.open.length}</b></div>
</div>
<h2>Summary</h2><p>${esc(r.narrative.text)}</p><p class="muted">Narrative: ${esc(r.narrative.draftedBy)}</p>
<h2>Inputs and provenance</h2>${table(['Input', 'Reference', 'Statements', 'Provenance'], r.inputs.map((i) => [esc(i.label), esc(i.ref), i.statements, `<span class="tag">${esc(i.provenance)}</span> ${esc(i.provenanceLabel)}`]))}
<h2>Requirements</h2><p>Normalisation: ${kv(r.normalisation)}</p>${r.delta ? `<p>Delta: <b>${esc(r.delta.summary)}</b></p>` : ''}
<p>By type: ${kv(r.requirements.byType)}<br>By status: ${kv(r.requirements.byStatus)}<br>By source: ${kv(r.requirements.bySource)}</p>
${table(['ID', 'Requirement', 'Type', 'Status', 'Superseded value'], r.requirements.list.map((q) => [esc(q.id), esc(q.text), esc(q.type), esc(q.status), esc(q.previous || '')]))}
<h2>Test cases</h2><p>Total ${r.testCases.total} &middot; by type: ${kv(r.testCases.byType)}<br>By phase tag (label): ${kv(r.testCases.byLabel)}<br>By status: ${kv(r.testCases.byStatus)} &middot; ${kv(r.testCases.byAutomation)}</p>
<h2>Automation</h2><p>${kv({ specs: r.automation.specs, 'specs new': r.automation.specsNew, 'specs changed': r.automation.specsChanged, 'cases covered': r.automation.casesCovered, 'cases not automated': r.automation.notAutomated.length })}</p>
${r.automation.notAutomated.length ? table(['Case', 'Name', 'Why not automated'], r.automation.notAutomated.map((t) => [esc(t.key), esc(t.name), esc(t.why)])) : ''}
<h2>Scripts</h2>${table(['File', 'Covers', 'Status', 'Version'], r.scripts.files.map((s) => [esc(s.file), esc(s.covers.join(', ')), esc(s.status), s.version]))}
<h2>Execution</h2>${ex.executed ? `<p>Really executed by ${esc(ex.tool)} against ${esc(ex.sut.name)} (build <code>${esc(ex.sut.build)}</code>) from ${esc(ex.startedAt)} to ${esc(ex.finishedAt)}.<br>Command: <code>${esc(ex.command)}</code></p>
<p>${kv({ executed: ex.summary.executed, passed: ex.summary.passed, failed: ex.summary.failed, quarantined: ex.quarantined, 'not run (manual)': ex.summary.notRun, 'pass rate %': ex.summary.passRate, 'duration ms': ex.durationMs })}</p><p class="muted">These numbers come from an actual Playwright run.</p>
${table(['Case', 'Requirement', 'Name', 'Result', 'Duration ms', 'Note'], ex.results.map((x) => [esc(x.key), esc(x.requirementId), esc(x.name), statusCell(x.status), x.duration, esc(x.reason || '')]))}` : '<p>Not executed.</p>'}
<h2>Defects</h2><p>Movement: ${kv(r.defects.movement)}${r.defects.resolved.length ? ` &middot; resolved: ${r.defects.resolved.map((d) => esc(d.id)).join(', ')}` : ''}</p>
${table(['ID', 'Title', 'Severity', 'Blocks release', 'Case', 'Rule', 'Requirement', 'Expected', 'Actual', 'Failing assertion', 'Movement'], r.defects.open.map((d) => [esc(d.id), esc(d.title), esc(d.severity), d.blocksRelease === null ? 'not assessed' : d.blocksRelease ? '<b class="fail">yes</b>' : 'no', esc(d.testCaseKey), esc(d.ruleId || '-'), esc(d.requirementId), esc(d.expected), esc(d.actual), `<code>${esc(d.assertion)}</code>`, esc(d.movement)]))}
<h2>Coverage</h2>${r.coverage ? `<p>${kv({ 'designed %': r.coverage.percent.designed, 'automated %': r.coverage.percent.automated, 'executed %': r.coverage.percent.executed, 'passing %': r.coverage.percent.passing })}</p>
${table(['Requirement', 'Cases', 'Automated', 'Executed', 'Failed', 'Status'], r.coverage.rows.map((c) => [esc(c.requirementId), c.cases, c.automated, c.executed, c.failed, esc(c.status)]))}
${r.coverage.attributes ? `<h3>Driver attribute coverage</h3><p>${esc(r.coverage.attributes.exercised)} of ${esc(r.coverage.attributes.driverCount)} ${esc(r.platform?.driversLabel || 'commission-driving attributes')} (of ${esc(r.coverage.attributes.attributeCount)} ${esc(r.platform?.modelLabel || 'reservation')} attributes) are varied by at least one test case (${esc(r.coverage.attributes.percent)}%).</p>
${table(['Attribute', 'Description', 'Varied by cases', 'Status'], r.coverage.attributes.rows.map((x) => [`<code>${esc(x.attribute)}</code>`, esc(x.description), esc(x.cases.join(', ') || '-'), esc(x.status)]))}` : ''}` : '-'}
<h2>Approvals</h2>${table(['Gate', 'Decision', 'By', 'When', 'Detail'], r.approvals.map((p) => [esc(p.gate), esc(p.decision), esc(p.by), esc(p.at), esc(p.detail)]))}
<h2>What this cycle reused</h2><p>${r.cycle.type === 'incremental' ? `${r.reuse.carriedOver} of ${r.reuse.total} test cases carried over (${r.reuse.percent}%).` : 'Baseline cycle: nothing reused, every artefact designed in this cycle.'} ${esc(r.reuse.note)}</p>
<h2>Skill hand-overs</h2><p>Overall: <b class="${r.handoverStatus === 'complete' ? 'pass' : 'fail'}">${esc(r.handoverStatus)}</b></p>
${table(['Phase', 'Skills seen', 'Hand-over', 'Artefacts owed'], (r.handovers || []).map((h) => [esc(h.label), esc(h.skills.join(', ') || '-'), `<span class="${h.status === 'complete' ? 'pass' : h.status === 'incomplete' ? 'fail' : 'muted'}">${esc(h.status)}</span>${h.missing.length ? `<br>missing: ${esc(h.missing.join(', '))}` : ''}`,
    h.items.map((i) => `${esc(i.key)}: ${esc(i.status)}${i.count !== null && i.count !== undefined ? ` (${i.count})` : ''}${i.note ? ` <span class="muted">${esc(i.note)}</span>` : ''}`).join('<br>')]))}
<h2>Honest labelling</h2><ul>${r.honesty.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
</body></html>`;
}

module.exports = { buildCycleReport, collectHandovers, renderReportHtml, APP_TITLE, esc, table, kv, CSS };
