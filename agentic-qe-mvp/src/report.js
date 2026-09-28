'use strict';
// Cycle report: every figure is computed here from persisted artifacts; the model (optional) drafts the narrative only.
const { draftNarrative } = require('./llm');

const APP_TITLE = 'Agentic QE Platform - MVP';

const countBy = (arr, fn) => arr.reduce((acc, x) => {
  const keys = [].concat(fn(x));
  for (const k of keys) acc[k] = (acc[k] || 0) + 1;
  return acc;
}, {});

async function buildCycleReport(cycle, { env = process.env } = {}) {
  const a = cycle.artifacts;
  const exec = a.execution || null;
  const defects = a.defects || [];
  const facts = {
    cycleName: cycle.name,
    cycleType: cycle.type,
    inputs: cycle.inputs.map((i) => `${i.label} ${i.ref} (${i.provenance.kind === 'live' ? 'live call' : i.provenance.kind === 'fixture' ? 'recorded fixture' : 'pasted'})`).join(', '),
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
  const narrative = await draftNarrative(facts, { env });
  return {
    title: `${APP_TITLE} - Cycle report`,
    generatedAt: new Date().toISOString(),
    cycle: {
      id: cycle.id, name: cycle.name, type: cycle.type, status: cycle.status, createdAt: cycle.createdAt, completedAt: cycle.completedAt || null,
      baselineId: cycle.baselineId, baselineVersionAtStart: cycle.baselineVersionAtStart, baselineVersionAfter: cycle.baselineVersionAfter ?? null,
      sutBuild: cycle.sutBuild,
    },
    inputs: cycle.inputs.map((i) => ({ slot: i.slot, label: i.label, ref: i.ref, summary: i.summary || i.description || null, statements: i.statementCount,
      provenance: i.provenance.kind, provenanceLabel: i.provenance.label, files: i.provenance.files || [] })),
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
    scripts: { total: a.scripts.length, byStatus: countBy(a.scripts, (s) => s.status), files: a.scripts.map((s) => ({ file: s.file, covers: s.covers, status: s.status, version: s.version })) },
    execution: exec ? {
      executed: true, tool: exec.tool, command: exec.command, sut: exec.sut, startedAt: exec.startedAt, finishedAt: exec.finishedAt, summary: exec.summary,
      results: exec.results.map((r) => ({ key: r.key, requirementId: r.requirementId, name: r.name, status: r.status, duration: r.duration, reason: r.reason || null })),
    } : { executed: false },
    defects: {
      open: defects.map((d) => ({ id: d.id, title: d.title, severity: d.severity, movement: d.movement, testCaseKey: d.testCaseKey, requirementId: d.requirementId, expected: d.expected, actual: d.actual, assertion: d.assertion })),
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
<p><b>${esc(r.cycle.name)}</b> (${esc(r.cycle.id)}, ${esc(r.cycle.type)}) &middot; status ${esc(r.cycle.status)} &middot; baseline ${esc(r.cycle.baselineId || '-')} ${r.cycle.baselineVersionAfter ? `v${esc(r.cycle.baselineVersionAfter)}` : ''} &middot; SUT build <code>${esc(r.cycle.sutBuild)}</code> &middot; generated ${esc(r.generatedAt)}</p>
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
<h2>Scripts</h2>${table(['File', 'Covers', 'Status', 'Version'], r.scripts.files.map((s) => [esc(s.file), esc(s.covers.join(', ')), esc(s.status), s.version]))}
<h2>Execution</h2>${ex.executed ? `<p>Really executed by ${esc(ex.tool)} against ${esc(ex.sut.name)} (build <code>${esc(ex.sut.build)}</code>) from ${esc(ex.startedAt)} to ${esc(ex.finishedAt)}.<br>Command: <code>${esc(ex.command)}</code></p>
<p>${kv({ executed: ex.summary.executed, passed: ex.summary.passed, failed: ex.summary.failed, 'not run (manual)': ex.summary.notRun, 'pass rate %': ex.summary.passRate })}</p>
${table(['Case', 'Requirement', 'Name', 'Result', 'Duration ms', 'Note'], ex.results.map((x) => [esc(x.key), esc(x.requirementId), esc(x.name), statusCell(x.status), x.duration, esc(x.reason || '')]))}` : '<p>Not executed.</p>'}
<h2>Defects</h2><p>Movement: ${kv(r.defects.movement)}${r.defects.resolved.length ? ` &middot; resolved: ${r.defects.resolved.map((d) => esc(d.id)).join(', ')}` : ''}</p>
${table(['ID', 'Title', 'Severity', 'Case', 'Requirement', 'Expected', 'Actual', 'Failing assertion', 'Movement'], r.defects.open.map((d) => [esc(d.id), esc(d.title), esc(d.severity), esc(d.testCaseKey), esc(d.requirementId), esc(d.expected), esc(d.actual), `<code>${esc(d.assertion)}</code>`, esc(d.movement)]))}
<h2>Coverage</h2>${r.coverage ? `<p>${kv({ 'designed %': r.coverage.percent.designed, 'automated %': r.coverage.percent.automated, 'executed %': r.coverage.percent.executed, 'passing %': r.coverage.percent.passing })}</p>
${table(['Requirement', 'Cases', 'Automated', 'Executed', 'Failed', 'Status'], r.coverage.rows.map((c) => [esc(c.requirementId), c.cases, c.automated, c.executed, c.failed, esc(c.status)]))}` : '-'}
<h2>Approvals</h2>${table(['Gate', 'Decision', 'By', 'When', 'Detail'], r.approvals.map((p) => [esc(p.gate), esc(p.decision), esc(p.by), esc(p.at), esc(p.detail)]))}
<h2>Honest labelling</h2><ul>${r.honesty.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
</body></html>`;
}

module.exports = { buildCycleReport, renderReportHtml, APP_TITLE, esc, table, kv, CSS };
