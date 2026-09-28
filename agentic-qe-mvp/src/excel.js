'use strict';
// Excel exports (exceljs). Test cases use Zephyr Scale-friendly column names.
const ExcelJS = require('exceljs');
const { APP_TITLE } = require('./report');

const TEST_CASE_COLUMNS = [
  { header: 'Key', key: 'key', width: 11 },
  { header: 'Name', key: 'name', width: 44 },
  { header: 'Objective', key: 'objective', width: 50 },
  { header: 'Precondition', key: 'precondition', width: 36 },
  { header: 'Test Step', key: 'steps', width: 52 },
  { header: 'Test Data', key: 'testData', width: 30 },
  { header: 'Expected Result', key: 'expected', width: 40 },
  { header: 'Priority', key: 'priority', width: 9 },
  { header: 'Type', key: 'type', width: 15 },
  { header: 'Labels', key: 'labels', width: 30 },
  { header: 'Requirement/Issue link', key: 'links', width: 22 },
  { header: 'Automation status', key: 'automation', width: 16 },
  { header: 'Cycle', key: 'cycle', width: 24 },
  { header: 'Change', key: 'change', width: 14 },
  { header: 'Version', key: 'version', width: 8 },
];

const FILL = {
  new: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDFF3E4' } },
  're-designed': { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1CC' } },
};

function styleHeader(ws) {
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF123A73' } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function newBook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = APP_TITLE;
  wb.title = APP_TITLE;
  wb.created = new Date();
  return wb;
}

function changeLabel(status, cycleType) {
  if (cycleType !== 'incremental') return 'Baseline';
  return status === 'new' ? 'New' : status === 're-designed' ? 'Changed' : 'Carried over';
}

function testCaseRows(cycle) {
  const reqs = new Map(cycle.artifacts.requirements.map((r) => [r.id, r]));
  return cycle.artifacts.testCases.map((t) => ({
    key: t.key,
    name: t.name,
    objective: t.objective,
    precondition: t.precondition,
    steps: t.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    testData: t.testData,
    expected: t.expected,
    priority: t.priority,
    type: t.type === 'functional' ? 'Functional' : 'Non-functional',
    labels: t.labels.join(', '),
    links: [...(reqs.get(t.requirementId)?.jiraKeys || []), t.requirementId].join(', '),
    automation: t.automation,
    cycle: cycle.name,
    change: changeLabel(t.status, cycle.type),
    version: t.version,
    _status: t.status,
    _prev: t.previous,
  }));
}

function addTestCaseSheet(wb, cycle) {
  const ws = wb.addWorksheet('Test Cases');
  ws.columns = TEST_CASE_COLUMNS;
  for (const r of testCaseRows(cycle)) {
    const { _status, _prev, ...values } = r;
    const row = ws.addRow(values);
    row.alignment = { wrapText: true, vertical: 'top' };
    if (cycle.type === 'incremental' && FILL[_status]) row.eachCell({ includeEmpty: true }, (c) => { c.fill = FILL[_status]; });
    if (_prev) row.getCell('expected').note = `Superseded (v${_prev.version}): ${_prev.expected}`;
  }
  styleHeader(ws);
  ws.autoFilter = { from: 'A1', to: { row: 1, column: TEST_CASE_COLUMNS.length } };
  return ws;
}

async function testCasesWorkbook(cycle) {
  const wb = newBook();
  addTestCaseSheet(wb, cycle);
  const info = wb.addWorksheet('About');
  info.columns = [{ header: 'Field', key: 'k', width: 26 }, { header: 'Value', key: 'v', width: 90 }];
  info.addRows([
    { k: 'Product', v: APP_TITLE },
    { k: 'Cycle', v: `${cycle.name} (${cycle.id})` },
    { k: 'Baseline', v: cycle.baselineId ? `${cycle.baselineId} v${cycle.baselineVersionAfter ?? cycle.baselineVersionAtStart ?? ''}` : 'n/a' },
    { k: 'Exported at', v: new Date().toISOString() },
    { k: 'Change column', v: cycle.type === 'incremental' ? 'New (green) / Changed (amber, superseded expected result in cell note) / Carried over' : 'Baseline cycle: all rows designed in this cycle' },
    { k: 'Designed vs executed', v: 'This sheet lists designed test cases. Execution results are in the cycle report.' },
  ]);
  styleHeader(info);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function sheetFromRows(wb, name, columns, rows) {
  const ws = wb.addWorksheet(name);
  ws.columns = columns.map(([header, key, width]) => ({ header, key, width: width || 18 }));
  rows.forEach((r) => { ws.addRow(r).alignment = { wrapText: true, vertical: 'top' }; });
  styleHeader(ws);
  return ws;
}

async function reportWorkbook(report, cycle) {
  const wb = newBook();
  const ex = report.execution;
  sheetFromRows(wb, 'Summary', [['Metric', 'k', 34], ['Value', 'v', 90]], [
    { k: 'Report', v: report.title }, { k: 'Cycle', v: `${report.cycle.name} (${report.cycle.id}, ${report.cycle.type})` },
    { k: 'Status', v: report.cycle.status }, { k: 'Baseline', v: `${report.cycle.baselineId || '-'} v${report.cycle.baselineVersionAfter ?? '-'}` },
    { k: 'SUT build', v: report.cycle.sutBuild },
    { k: 'Requirements', v: report.requirements.total }, { k: 'Delta', v: report.delta ? report.delta.summary : 'n/a (baseline)' },
    { k: 'Test cases', v: report.testCases.total }, { k: 'Test cases by type', v: JSON.stringify(report.testCases.byType) },
    { k: 'Test cases by label', v: JSON.stringify(report.testCases.byLabel) }, { k: 'Scripts', v: report.scripts.total },
    { k: 'Executed (real)', v: ex.executed ? ex.summary.executed : 0 }, { k: 'Passed', v: ex.executed ? ex.summary.passed : 0 },
    { k: 'Failed', v: ex.executed ? ex.summary.failed : 0 }, { k: 'Pass rate %', v: ex.executed ? ex.summary.passRate : 0 },
    { k: 'Execution tool', v: ex.executed ? ex.tool : 'not executed' }, { k: 'Defects', v: report.defects.open.length },
    { k: 'Coverage (passing %)', v: report.coverage ? report.coverage.percent.passing : 0 },
    { k: 'Narrative', v: report.narrative.text }, { k: 'Narrative drafted by', v: report.narrative.draftedBy },
  ]);
  sheetFromRows(wb, 'Inputs', [['Input', 'label', 18], ['Reference', 'ref', 40], ['Statements', 'statements', 12], ['Provenance', 'provenance', 12], ['Provenance detail', 'provenanceLabel', 80]], report.inputs);
  sheetFromRows(wb, 'Requirements', [['ID', 'id', 10], ['Requirement', 'text', 70], ['Type', 'type', 16], ['Status', 'status', 14], ['Version', 'version', 8], ['Superseded value', 'previous', 60]], report.requirements.list);
  addTestCaseSheet(wb, cycle);
  sheetFromRows(wb, 'Execution', [['Case', 'key', 11], ['Requirement', 'requirementId', 12], ['Name', 'name', 60], ['Result', 'status', 10], ['Duration ms', 'duration', 12], ['Note', 'reason', 50]], ex.executed ? ex.results : []);
  sheetFromRows(wb, 'Defects', [['ID', 'id', 9], ['Title', 'title', 50], ['Severity', 'severity', 9], ['Case', 'testCaseKey', 10], ['Requirement', 'requirementId', 12], ['Expected', 'expected', 14], ['Actual', 'actual', 14], ['Failing assertion', 'assertion', 50], ['Movement', 'movement', 12]], report.defects.open);
  sheetFromRows(wb, 'Coverage', [['Requirement', 'requirementId', 12], ['Text', 'text', 70], ['Cases', 'cases', 8], ['Automated', 'automated', 10], ['Executed', 'executed', 10], ['Failed', 'failed', 8], ['Status', 'status', 24]], report.coverage ? report.coverage.rows : []);
  sheetFromRows(wb, 'Approvals', [['Gate', 'gate', 26], ['Decision', 'decision', 10], ['By', 'by', 18], ['When', 'at', 26], ['Detail', 'detail', 80]], report.approvals);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function compareWorkbook(c) {
  const wb = newBook();
  const art = (label, d) => ({ artifact: label, a: d.countA, b: d.countB, added: d.added.length, changed: d.changed.length, unchanged: d.unchanged.length, addedIds: d.added.join(', '), changedIds: d.changed.join(', ') });
  sheetFromRows(wb, 'Artifacts', [['Artifact', 'artifact', 14], [c.a.id, 'a', 10], [c.b.id, 'b', 10], ['Added', 'added', 8], ['Changed', 'changed', 9], ['Unchanged', 'unchanged', 10], ['Added IDs', 'addedIds', 50], ['Changed IDs', 'changedIds', 50]],
    [art('Requirements', c.requirements), art('Test cases', c.testCases), art('Scripts', c.scripts)]);
  sheetFromRows(wb, 'Changed requirements', [['ID', 'id', 10], [`Before (${c.a.id})`, 'before', 60], [`After (${c.b.id})`, 'after', 60]], c.requirements.changedDetail);
  sheetFromRows(wb, 'Execution', [['Metric', 'm', 14], [c.a.id, 'a', 10], [c.b.id, 'b', 10]], ['executed', 'passed', 'failed', 'passRate'].map((m) => ({ m, a: c.execution.a[m], b: c.execution.b[m] })));
  sheetFromRows(wb, 'Defects', [['Movement', 'm', 14], ['Defect IDs', 'ids', 60]], [
    { m: `${c.a.id} defects`, ids: c.defects.a.join(', ') }, { m: `${c.b.id} defects`, ids: c.defects.b.join(', ') },
    { m: 'new', ids: c.defects.new.join(', ') }, { m: 'still open', ids: c.defects.stillOpen.join(', ') }, { m: 'resolved', ids: c.defects.resolved.join(', ') }]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { testCasesWorkbook, reportWorkbook, compareWorkbook, TEST_CASE_COLUMNS, testCaseRows };
