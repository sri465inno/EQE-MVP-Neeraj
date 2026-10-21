'use strict';
// Downloadable exports for a completed run: Excel workbooks and the QE lead report.
const ExcelJS = require('exceljs');
const { levelOf } = require('./catalog');

const HEAD = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D2742' } } };
function sheet(wb, name, columns, rows) {
  const ws = wb.addWorksheet(name);
  ws.columns = columns.map(([header, key, width]) => ({ header, key, width: width || 18 }));
  ws.getRow(1).eachCell((c) => { c.font = HEAD.font; c.fill = HEAD.fill; });
  rows.forEach((r) => ws.addRow(r));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.eachRow((row) => row.eachCell((c) => { c.alignment = { vertical: 'top', wrapText: true }; }));
  return ws;
}

async function reportXlsx(run) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'EQE dashboard';
  const r = run.report; const m = r.metrics;
  sheet(wb, 'Summary', [['Item', 'k', 32], ['Value', 'v', 70]], [
    { k: 'Run', v: run.id }, { k: 'Initiative', v: run.config.initiative }, { k: 'Application', v: `StayEase ${r.release || ''} (${run.config.appUrl})` },
    { k: 'Release decision', v: r.decision }, { k: 'Reasons', v: r.reasons.join('\n') }, { k: 'Sign-off owner', v: r.signOffOwner }, { k: 'Reviewer', v: run.review?.approvedBy || run.config.reviewer || '' },
    { k: 'Stories', v: m.stories }, { k: 'Acceptance criteria', v: m.acs }, { k: 'Test cases', v: m.testCases }, { k: 'Automation scripts', v: m.automated },
    { k: 'Automation test cases passed', v: `${m.passed}/${m.executed}` }, { k: 'Automation pass rate', v: `${m.passRate}%` }, { k: 'AC coverage', v: `${m.acCoverage}%` }, { k: 'Defects', v: m.defects },
  ]);
  sheet(wb, 'Traceability', [['Story', 'storyKey', 10], ['AC', 'acId', 12], ['Acceptance criterion', 'acText', 60], ['Testability', 'testability', 16], ['Test cases', 'tests', 24], ['Scripts', 'scripts', 26], ['Status', 'status', 12], ['Defects', 'defects', 12]],
    r.trace.map((t) => ({ ...t, tests: t.tests.map((x) => `${x.id} (${x.result})`).join('\n'), scripts: t.tests.filter((x) => x.script).map((x) => x.script).join('\n'), defects: t.defects.join(', ') })));
  sheet(wb, 'Results', [['Test case', 'tcId', 10], ['Title', 'title', 60], ['Result', 'status', 10], ['Duration (s)', 'd', 12], ['Failed step', 'failedStep', 40], ['Error', 'error', 60]],
    run.execution.results.map((x) => ({ ...x, d: (x.durationMs / 1000).toFixed(1) })));
  sheet(wb, 'Defects', [['Defect', 'key', 10], ['Severity', 'severity', 10], ['Summary', 'title', 60], ['Stories', 's', 14], ['Test case', 'tcId', 10], ['Actual', 'actual', 60]],
    r.defects.map((d) => ({ ...d, key: d.jiraKey || d.id, s: d.storyKeys.join(', ') })));
  return wb.xlsx.writeBuffer();
}

// Zephyr Scale-style import sheet: one row per step.
async function testCasesXlsx(run) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'EQE dashboard';
  const rows = [];
  for (const t of run.testCases) t.steps.forEach((s, i) => rows.push({
    id: i ? '' : t.id, name: i ? '' : t.title, objective: i ? '' : t.type, precondition: i ? '' : t.preconditions || '', priority: i ? '' : t.priority,
    automation: i ? '' : t.automation, level: i ? '' : levelOf(run, t), coverage: i ? '' : [...t.storyKeys, ...t.acIds].join(', '), step: s.action, data: s.value ?? '', expected: s.expected || '',
  }));
  sheet(wb, 'Test cases', [['Key', 'id', 9], ['Name', 'name', 50], ['Objective', 'objective', 14], ['Precondition', 'precondition', 30], ['Priority', 'priority', 9], ['Automation', 'automation', 12], ['Level', 'level', 14], ['Coverage (issues)', 'coverage', 30], ['Test script (step-by-step) - Step', 'step', 50], ['Test data', 'data', 22], ['Expected result', 'expected', 40]], rows);
  return wb.xlsx.writeBuffer();
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function leadReportHtml(run) {
  const r = run.report; const m = r.metrics;
  const color = { Go: '#1e7a4a', 'No-go': '#a32020', Conditional: '#9a6a12' }[r.decision];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>QE lead report ${run.id}</title><style>body{font-family:Inter,Segoe UI,Arial,sans-serif;margin:32px auto;max-width:980px;color:#1a1d24}h1{color:#0d2742}h2{color:#0d2742;border-bottom:2px solid #c9952d;padding-bottom:4px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #dcd4c8;padding:6px 8px;text-align:left;vertical-align:top;font-size:13px}th{background:#0d2742;color:#fff}.d{display:inline-block;padding:6px 16px;color:#fff;background:${color};font-weight:700;font-size:22px}</style></head><body>
<h1>QE lead report · ${esc(run.id)}</h1><p>StayEase ${esc(r.release || '')} · ${esc(run.config.appUrl)} · requirements ${esc(run.config.initiative)} · generated ${esc(new Date(r.generatedAt).toLocaleString())}</p>
<p><span class="d">${esc(r.decision)}</span></p><ul>${r.reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><p>Sign-off owner: <b>${esc(r.signOffOwner)}</b> · Reviewer: ${esc(run.review?.approvedBy || run.config.reviewer || '')}</p>
<h2>Metrics</h2><table><tr><th>Stories</th><th>AC</th><th>Test cases</th><th>Automation scripts</th><th>Automation test cases passed</th><th>Automation pass rate</th><th>AC coverage</th><th>Defects</th></tr><tr><td>${m.stories}</td><td>${m.acs}</td><td>${m.testCases}</td><td>${m.automated}</td><td>${m.passed}/${m.executed}</td><td>${m.passRate}%</td><td>${m.acCoverage}%</td><td>${m.defects}</td></tr></table>
<h2>Defects</h2>${r.defects.length ? `<table><tr><th>Defect</th><th>Severity</th><th>Summary</th><th>Stories</th></tr>${r.defects.map((d) => `<tr><td>${esc(d.jiraKey || d.id)}</td><td>${esc(d.severity)}</td><td>${esc(d.title)}</td><td>${esc(d.storyKeys.join(', '))}</td></tr>`).join('')}</table>` : '<p>None.</p>'}
<h2>Story status</h2><table><tr><th>Story</th><th>Priority</th><th>Status</th><th>AC passed / failed / manual</th></tr>${r.storyStatus.map((s) => `<tr><td>${esc(s.key)} ${esc(s.summary)}</td><td>${esc(s.priority)}</td><td>${esc(s.status)}</td><td>${s.passed} / ${s.failed} / ${s.manual} of ${s.acs}</td></tr>`).join('')}</table>
<h2>Traceability</h2><table><tr><th>Story</th><th>AC</th><th>Test cases</th><th>Status</th><th>Defects</th></tr>${r.trace.map((t) => `<tr><td>${esc(t.storyKey)}</td><td>${esc(t.acId)} ${esc(t.acText)}</td><td>${esc(t.tests.map((x) => `${x.id} (${x.result})`).join(', '))}</td><td>${esc(t.status)}</td><td>${esc(t.defects.join(', '))}</td></tr>`).join('')}</table>
<h2>Release criteria applied</h2><p>Automation pass rate ≥ ${r.criteria.minAutomationPassRate}% · AC coverage ≥ ${r.criteria.minAcceptanceCriteriaCoverage}% · No-go severities: ${esc(r.criteria.noGoSeverities.join(', '))} · Conditional severities: ${esc(r.criteria.conditionalSeverities.join(', '))}</p>
</body></html>`;
}
module.exports = { reportXlsx, testCasesXlsx, leadReportHtml };
