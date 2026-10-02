'use strict';
/* Runs the hotel booking Flow 1 cycles (functional, regression, end-to-end), then the commission baseline and its
   Flow 2 increment, end to end, and writes every artifact to a folder for demos.
   Usage: node scripts/export-demo-artifacts.js [outDir]   (default: demo-artifacts/) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../src/server');
const { renderReportHtml } = require('../src/report');
const { compareCycles, renderCompareHtml } = require('../src/compare');
const { testCasesWorkbook, reportWorkbook, compareWorkbook } = require('../src/excel');
const { buildLeadReport, renderLeadPage, renderLeadMarkdown } = require('../src/lead-report');
const { dataSetFile } = require('../src/agents/testdata');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'demo-artifacts'));
const REVIEWER = 'Priya Shah';
const APPROVER = 'Sam Lee';
const BASELINE_INPUTS = { initiative: { mode: 'github', key: 'COM-1' }, epic: { mode: 'github', key: 'COM-10' }, codebase: { mode: 'github', branch: 'demo/commission-engine' } };
const HOTEL_INPUTS = { initiative: { mode: 'github', key: 'AQPI-1' }, epic: { mode: 'github', key: 'AQPI-2, AQPI-6, AQPI-10, AQPI-14, AQPI-18, AQPI-23, AQPI-27' }, codebase: { mode: 'github', branch: 'demo/hotel-booking-platform' } };
const HOTEL_TESTING_TYPES = [['functional', 'Functional'], ['regression', 'Regression'], ['e2e', 'End-to-end']];
const INCREMENT_INPUTS = { epic: { mode: 'github', key: 'COM-20' }, codebase: { mode: 'github', branch: 'demo/commission-engine-v2' } };

const json = (f, v) => write(f, `${JSON.stringify(v, null, 2)}\n`);
function write(f, body) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); }
const cell = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const mdTable = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');

async function exportCycle(pipeline, store, c, dir) {
  const a = c.artifacts;
  const run = store.runDir(c.id);
  json(path.join(dir, '01-inputs', 'inputs.json'), c.inputs);
  json(path.join(dir, '01-inputs', 'normalisation.json'), c.normalisation);
  if (c.reviewAgent) json(path.join(dir, '01-inputs', 'review-agent.json'), c.reviewAgent);
  if (c.delta) json(path.join(dir, '01-inputs', 'delta-classification.json'), c.delta);
  json(path.join(dir, '02-requirements', 'requirements.json'), a.requirements);
  json(path.join(dir, '03-business-rules', 'business-rules.json'), a.rules);
  json(path.join(dir, '04-test-cases', 'test-cases.json'), a.testCases);
  write(path.join(dir, '04-test-cases', `${c.id}-test-cases.xlsx`), await testCasesWorkbook(c));
  const { dictionary } = pipeline.dictionaryOf(c);
  json(path.join(dir, '05-test-data', 'test-data-summary.json'), { ...a.testDataSummary, sets: a.testData });
  for (const d of a.testData) json(path.join(dir, '05-test-data', `${d.testCaseKey}.json`), dataSetFile(d, dictionary));
  for (const s of a.scripts) write(path.join(dir, '06-automation-scripts', s.file), s.code);
  json(path.join(dir, '07-execution', 'results.json'), a.execution);
  for (const f of ['playwright-report.json', 'playwright-output.txt']) fs.copyFileSync(path.join(run, f), path.join(dir, '07-execution', f));
  fs.cpSync(path.join(run, 'evidence'), path.join(dir, '07-execution', 'evidence'), { recursive: true });
  json(path.join(dir, '08-defects', 'defects.json'), a.defects);
  write(path.join(dir, '09-report', `${c.id}-cycle-report.html`), renderReportHtml(c.report));
  write(path.join(dir, '09-report', `${c.id}-cycle-report.xlsx`), await reportWorkbook(c.report, c));
  json(path.join(dir, '09-report', `${c.id}-cycle-report.json`), c.report);
  if (c.mergeProposal) json(path.join(dir, '10-merge-approval', 'merge-proposal.json'), { proposal: c.mergeProposal, approvals: c.approvals });

  const lead = buildLeadReport(c);
  write(path.join(dir, '09-report', `${c.id}-qe-lead-report.html`), renderLeadPage(lead));
  write(path.join(dir, '09-report', `${c.id}-qe-lead-report.md`), renderLeadMarkdown(lead));
  const ex = a.execution.summary;
  const md = [renderLeadMarkdown(lead),
    '## Appendix A: test results (real Playwright run)', mdTable(['Key', 'Test', 'Result', 'ms'], a.execution.results.map((r) => [r.key, r.name, r.status, r.duration ?? ''])), '',
    '## Appendix B: requirements', mdTable(['ID', 'Requirement', 'Status'], a.requirements.map((r) => [r.id, r.text, r.status])), '',
  ].join('\n');
  write(path.join(dir, 'README.md'), md);
  return ex;
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aqe-demo-'));
  const { pipeline, store } = createApp({ dataDir, env: {} });

  const hotel = [];
  for (const [testingType, label] of HOTEL_TESTING_TYPES) {
    let h = await pipeline.startCycle({ type: 'baseline', name: `Hotel booking baseline · ${label}`, inputs: HOTEL_INPUTS, reviewer: REVIEWER, testingType });
    await pipeline.review(h.id, { reviewer: REVIEWER }).done;
    h = store.getCycle(h.id);
    if (h.status !== 'completed') throw new Error(`${h.id} ended as ${h.status}`);
    hotel.push(h);
  }

  let c1 = await pipeline.startCycle({ type: 'baseline', name: 'Commission baseline', inputs: BASELINE_INPUTS, reviewer: REVIEWER });
  const conflict = c1.normalisation.groups.find((g) => g.bucket === 'conflict');
  const pick = conflict.options.find((o) => o.signature === '1.5 %');
  await pipeline.review(c1.id, { reviewer: REVIEWER, resolutions: { [conflict.id]: pick.optionId } }).done;
  c1 = store.getCycle(c1.id);

  let c2 = await pipeline.startCycle({ type: 'incremental', name: 'Commission increment (COM-20, engine 2.0)', baselineId: c1.baselineId, inputs: INCREMENT_INPUTS, reviewer: REVIEWER });
  await pipeline.review(c2.id, { reviewer: REVIEWER }).done;
  await pipeline.decideMerge(c2.id, { decision: 'approve', approver: APPROVER }).done;
  c2 = store.getCycle(c2.id);
  for (const c of [c1, c2]) if (c.status !== 'completed') throw new Error(`${c.id} ended as ${c.status}`);

  fs.rmSync(OUT, { recursive: true, force: true });
  const eh = [];
  for (const h of hotel) eh.push(await exportCycle(pipeline, store, h, path.join(OUT, `flow-1-hotel-${h.testingType}-${h.id}`)));
  const e1 = await exportCycle(pipeline, store, c1, path.join(OUT, `flow-1-baseline-${c1.id}`));
  const e2 = await exportCycle(pipeline, store, c2, path.join(OUT, `flow-2-incremental-${c2.id}`));
  const cmp = compareCycles(c1, c2);
  write(path.join(OUT, 'comparison', `compare-${c1.id}-vs-${c2.id}.html`), renderCompareHtml(cmp));
  write(path.join(OUT, 'comparison', `compare-${c1.id}-vs-${c2.id}.xlsx`), await compareWorkbook(cmp));
  json(path.join(OUT, 'comparison', `compare-${c1.id}-vs-${c2.id}.json`), cmp);

  const row = (c, e) => [c.id, `${c.type} · ${c.testingType}`, c.artifacts.requirements.length, c.artifacts.testCases.length, c.artifacts.scripts.length, `${e.passed}/${e.executed}`, `${e.passRate}%`, c.artifacts.defects.length];
  write(path.join(OUT, 'README.md'), [
    '# Agentic QE Platform - demo artifacts', '',
    `Generated ${new Date().toISOString()} by \`node scripts/export-demo-artifacts.js\`. Every cycle was run end to end; the Playwright results are real runs against the system under test.`, '',
    '## Flow 1: hotel booking platform (AQPI)', '',
    'Inputs: the AQPI-1 initiative, its 7 epics and 23 stories (Jira REST v3 export of the AQPI space on GitHub branch `demo/jira-export`) and the Java 21 Spring Boot WebFlux codebase on branch `demo/hotel-booking-platform`. The cases ran against the six real hotel services (search, hotel, offer, cart, reservation, notification) started from their built jars on free local ports. Cases the platform cannot automate against these APIs (for example browser accessibility and measured load targets) are reported as manual, not run.', '',
    mdTable(['Cycle', 'Mode · testing', 'Requirements', 'Test cases', 'Scripts', 'Passed', 'Pass rate', 'Defects'], hotel.map((h, i) => row(h, eh[i]))), '',
    '## Flow 2: commission engine (COM)', '',
    'Inputs: Jira REST v3 exports (synthetic issues COM-1, COM-10/COM-11, COM-20) and the commission-engine codebase, pulled from GitHub branches `demo/jira-export`, `demo/commission-engine` and `demo/commission-engine-v2`. The commission baseline is run first so Flow 2 has a baseline to add to. No live Jira call was made.', '',
    mdTable(['Cycle', 'Mode · testing', 'Requirements', 'Test cases', 'Scripts', 'Passed', 'Pass rate', 'Defects'], [row(c1, e1), row(c2, e2)]), '',
    'Each cycle folder\'s README is its QE lead report: inputs taken, how the cycle was run, artifacts produced, risks, a go/no-go recommendation and sign-off.', '',
    '## Folder layout (per cycle)',
    '- `01-inputs/` inputs with provenance, normalisation (agreed / single-source / conflicts) and, for Flow 2, the delta classification',
    '- `02-requirements/` reviewed requirements repository',
    '- `03-business-rules/` business rules with source quotes',
    '- `04-test-cases/` test cases (JSON and Zephyr Scale Excel export)',
    '- `05-test-data/` one data set per test case, generated by the test data agent from the data dictionary and checked against it',
    '- `06-automation-scripts/` generated Playwright specs (each loads its case\'s data set)',
    '- `07-execution/` real Playwright JSON report, console output, mapped results and per-test evidence',
    '- `08-defects/` defects raised from real failures only',
    '- `09-report/` QE lead report (HTML, Markdown) and full cycle report (HTML, Excel, JSON)',
    '- `10-merge-approval/` (Flow 2) merge proposal and approvals', '',
    `\`comparison/\` holds the commission ${c1.id} vs ${c2.id} comparison (HTML, Excel, JSON).`,
    'Open the `.html` files in a browser (download them or clone the repo; GitHub shows HTML as source).', '',
  ].join('\n'));
  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log(`Wrote ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
