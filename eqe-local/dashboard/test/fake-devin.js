'use strict';
// Stand-in for the Devin API v3 (sessions, messages, attachments) to test the Devin engine offline without ACUs.
// It plays a scripted session: each poll moves one phase forward, stops at the two gates until the dashboard's message,
// and runs a small real Playwright suite against StayEase so the automation zip, results and artifacts are genuine.
// Usage: node dashboard/test/fake-devin.js, then DEVIN_API_URL=http://localhost:4300 DEVIN_API_KEY=cog_test DEVIN_ORG_ID=org-test.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const express = require('express');
const unzipper = require('unzipper');
const archiver = require('archiver');
const { parseDescription } = require('../src/jira');
const { classify, storyStage } = require('../src/catalog');
const { TEMPLATE } = require('../src/devin/brief');

const PORT = Number(process.env.FAKE_DEVIN_PORT || 4300);
const ROOT = path.resolve(__dirname, '..', '..');
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-devin-'));
const app = express();
const files = {}; const sessions = {};
const url = (p) => `http://localhost:${PORT}${p}`;
app.use((req, res, next) => { if (!/^Bearer cog_/.test(req.headers.authorization || '') && !req.path.startsWith('/files/')) return res.status(403).json({ title: 'Forbidden', status: 403, detail: 'Unauthorized' }); next(); });

app.post('/v3/organizations/:org/attachments', express.raw({ type: 'multipart/form-data', limit: '50mb' }), (req, res) => {
  const b = req.body; const boundary = '--' + req.headers['content-type'].split('boundary=')[1];
  const start = b.indexOf('\r\n\r\n') + 4; const end = b.lastIndexOf('\r\n' + boundary);
  const name = (b.slice(0, start).toString().match(/filename="([^"]+)"/) || [])[1] || 'file';
  const id = `att-${Object.keys(files).length + 1}`; const f = path.join(WORK, `${id}-${name}`);
  fs.writeFileSync(f, b.slice(start, end)); files[id] = { name, file: f };
  res.json({ attachment_id: id, name, url: url(`/files/${id}`) });
});
app.get('/files/:id', (req, res) => res.download(files[req.params.id].file, files[req.params.id].name));
// Like the real API: the download endpoint redirects to a presigned URL.
app.get('/v3/organizations/:org/attachments/:id/:name', (req, res) => (files[req.params.id] ? res.redirect(307, url(`/files/${req.params.id}`)) : res.status(404).json({ status: 404, title: 'Not Found' })));

app.post('/v3/organizations/:org/sessions', express.json({ limit: '5mb' }), async (req, res) => {
  const id = `devin-fake${Date.now()}`;
  const att = files[req.body.attachment_urls[0].split('/').pop()];
  const dir = path.join(WORK, id); await (await unzipper.Open.file(att.file)).extract({ path: dir });
  sessions[id] = { id, body: req.body, dir, step: 0, out: { protocol: 'eqe-cycle/1', phase: 'starting', log: [] }, messages: [], attachments: [] };
  res.json({ session_id: id, url: url(`/sessions/${id}`), status: 'new', acus_consumed: 0, tags: req.body.tags || [] });
});
app.post('/v3/organizations/:org/sessions/:id/messages', express.json(), (req, res) => {
  const s = sessions[req.params.id]; s.messages.push(req.body.message); res.json({ session_id: s.id, status: 'running' });
});
app.get('/v3/organizations/:org/sessions/:id/attachments', (req, res) => res.json({ items: sessions[req.params.id].attachments }));
app.get('/v3/organizations/:org/sessions/:id', (req, res) => {
  const s = sessions[req.params.id];
  try { advance(s); } catch (e) { s.out.phase = 'failed'; s.out.error = e.message; }
  const gate = ['awaiting_test_approval', 'awaiting_execution_review', 'done'].includes(s.out.phase);
  res.json({ session_id: s.id, url: url(`/sessions/${s.id}`), status: 'running', status_detail: gate ? 'waiting_for_user' : 'working', acus_consumed: s.step * 0.4, structured_output: s.out });
});

const say = (s, stage, msg) => { s.out.log.push({ stage, level: 'info', msg }); s.out.log = s.out.log.slice(-60); };
function advance(s) {
  const o = s.out; const cycle = JSON.parse(fs.readFileSync(path.join(s.dir, 'cycle.json'), 'utf8'));
  const jira = JSON.parse(fs.readFileSync(path.join(s.dir, 'jira', 'issues.json'), 'utf8'));
  const msg = (p) => s.messages.find((m) => m.startsWith(p));
  if (msg('EQE-CANCEL')) { o.phase = 'failed'; o.error = 'Cancelled'; return; }
  s.step++;
  switch (o.phase) {
    case 'starting': o.app = { url: 'http://localhost:4100', release: cycle.app.release, ready: true }; o.phase = 'intake'; say(s, 'setup', `StayEase ${cycle.app.release} started`); break;
    case 'intake':
      o.intake = { summary: `${jira.stories.length} stories read from ${jira.initiative.key}.`, gaps: [{ storyKey: jira.stories[0].key, text: 'Fake gap for testing' }],
        stories: jira.stories.map((st) => { const d = parseDescription(st.description); return { key: st.key, summary: st.summary, epicKey: st.parent, priority: st.priority, text: d.text, ac: d.ac.map((t, i) => ({ id: `${st.key}-AC${i + 1}`, text: t })), testData: d.testData }; }) };
      o.phase = 'analysis'; say(s, 'intake', 'Intake done'); break;
    case 'analysis':
      o.analysis = { summary: 'Fake analysis.', stories: o.intake.stories.map((st) => {
        const stage = storyStage(st.summary, jira.epics.find((e) => e.key === st.epicKey)?.summary);
        return { key: st.key, stage: ['search', 'results', 'hotel', 'member', 'booking', 'find', 'account'].includes(stage) ? stage : 'unknown', risk: st.priority === 'High' ? 'High' : 'Medium', riskReason: `Priority ${st.priority} on the ${stage} step`, qualityScore: 80, findings: [], questions: ['Fake question?'],
          acs: st.ac.map((a) => { const c = classify(a.text, { stage, story: st }); return { id: a.id, technique: c.label, kind: c.kind === 'variant' ? 'variant' : c.kind === 'manual' ? 'manual' : 'journey', testability: c.technique === 'ambiguous' ? 'Ambiguous' : c.kind === 'manual' ? 'Not UI-observable' : 'Testable', issues: [], reason: c.reason || '' }; }) };
      }) };
      o.phase = 'design'; break;
    case 'design': {
      const acs = o.analysis.stories.flatMap((st) => st.acs.map((a) => ({ ...a, storyKey: st.key })));
      const auto = acs.filter((a) => a.kind !== 'manual'); const man = acs.filter((a) => a.kind === 'manual');
      o.design = { summary: 'Fake design.', testCases: [
        { id: 'TC-001', title: 'Home page shows the search form', type: 'E2E journey', automation: 'Automation', priority: 'P1', acIds: auto.slice(0, Math.ceil(auto.length / 2)).map((a) => a.id), storyKeys: [], steps: [{ n: 1, action: 'Open the home page', expected: 'StayEase is shown' }], data: {}, rationale: 'Smoke' },
        { id: 'TC-002', title: 'Find reservation with unknown details', type: 'Negative', automation: 'Automation', priority: 'P2', acIds: auto.slice(Math.ceil(auto.length / 2)).map((a) => a.id), steps: [{ n: 1, action: 'Find SE000000 / Nobody', expected: 'Reservation details shown (deliberately wrong)' }], data: { confirmationNumber: 'SE000000' } },
        ...(man.length ? [{ id: 'TC-003', title: 'Manual checks', type: 'Manual', automation: 'Manual', priority: 'P3', acIds: man.map((a) => a.id), steps: [{ n: 1, action: 'Check by hand' }] }] : []),
      ], uncovered: [] };
      o.phase = 'awaiting_test_approval'; say(s, 'design', 'Waiting for EQE-APPROVAL'); break;
    }
    case 'awaiting_test_approval':
      if (!msg('EQE-APPROVAL')) { s.step--; break; }
      o.phase = 'scripts'; say(s, 'scripts', `Approval received: ${msg('EQE-APPROVAL').slice(0, 80)}`); break;
    case 'scripts': {
      const auto = path.join(s.dir, 'automation');
      for (const [n, src] of Object.entries(TEMPLATE)) { fs.mkdirSync(path.dirname(path.join(auto, n)), { recursive: true }); fs.writeFileSync(path.join(auto, n), src); }
      fs.mkdirSync(path.join(auto, 'tests'), { recursive: true }); fs.mkdirSync(path.join(auto, 'pages'), { recursive: true });
      fs.writeFileSync(path.join(auto, 'pages', 'home.page.ts'), "import type { Locator, Page } from '@playwright/test';\nexport class HomePage { readonly search: Locator; constructor(readonly page: Page) { this.search = page.getByRole('button', { name: 'Search' }); } }\n");
      fs.writeFileSync(path.join(auto, 'tests', 'TC-001.spec.ts'), "import { test, expect } from '../support/fixtures';\nimport { HomePage } from '../pages/home.page';\ntest('TC-001 Home page shows the search form', async ({ page }) => {\n  await test.step('1. Open the home page', async () => { await page.goto('/'); await expect(new HomePage(page).search).toBeVisible(); });\n});\n");
      fs.writeFileSync(path.join(auto, 'tests', 'TC-002.spec.ts'), "import { test, expect } from '../support/fixtures';\ntest('TC-002 Find reservation with unknown details', async ({ page }) => {\n  await test.step('1. Find SE000000 / Nobody', async () => { await page.goto('/'); await expect(page.getByText('Reservation details')).toBeVisible({ timeout: 2000 }); });\n});\n");
      o.scripts = { summary: 'Fake scripts.', cases: [{ tcId: 'TC-001', file: 'tests/TC-001.spec.ts', status: 'generated' }, { tcId: 'TC-002', file: 'tests/TC-002.spec.ts', status: 'generated' }], pageObjects: [{ class: 'HomePage', file: 'pages/home.page.ts', locators: [{ prop: 'search', locator: "page.getByRole('button', { name: 'Search' })" }] }] };
      o.phase = 'execution'; break;
    }
    case 'execution': {
      const auto = path.join(s.dir, 'automation');
      try { execFileSync(process.execPath, [path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js'), 'test'], { cwd: auto, env: { ...process.env, NODE_PATH: path.join(ROOT, 'node_modules'), BASE_URL: 'http://localhost:4100', CI: '1' }, stdio: 'ignore' }); } catch { /* failures expected */ }
      const r = JSON.parse(fs.readFileSync(path.join(auto, 'results', 'results.json'), 'utf8'));
      const zipName = `eqe-${cycle.id}-automation.zip`; const zip = path.join(s.dir, zipName);
      execFileSync('zip', ['-qr', zip, 'tests', 'pages', 'support', 'playwright.config.ts', 'package.json', 'results', 'report'], { cwd: auto });
      const id = `att-${Object.keys(files).length + 1}`; files[id] = { name: zipName, file: zip };
      s.attachments.push({ attachment_id: id, name: zipName, url: url(`/files/${id}`), source: 'devin' });
      o.execution = { summary: 'Fake execution.', passed: r.stats.expected, failed: r.stats.unexpected, skipped: r.stats.skipped, durationMs: Math.round(r.stats.duration),
        results: [{ tcId: 'TC-001', status: 'passed' }, { tcId: 'TC-002', status: 'failed', failedStep: '1. Find SE000000 / Nobody', triage: { category: 'script-issue', confidence: 'high', rationale: 'Spec expects details for an unknown reservation.', suggestedFix: 'Expect "No reservation" instead', raiseDefect: false } }] };
      o.artifacts = { automationZip: zipName }; o.phase = 'awaiting_execution_review'; break;
    }
    case 'awaiting_execution_review':
      if (!msg('EQE-EXEC-REVIEW')) { s.step--; break; }
      o.phase = 'reporting'; break;
    case 'reporting': {
      const xr = JSON.parse(msg('EQE-EXEC-REVIEW').slice('EQE-EXEC-REVIEW '.length));
      o.reporting = { executiveSummary: 'Fake executive summary for the release manager.', recommendation: { decision: 'Conditional', reasons: ['Fake reason'] }, risks: ['Fake risk'],
        defects: xr.defects.filter((d) => d.raise).map((d) => ({ tcId: d.tcId, title: `AI title for ${d.tcId}`, severity: 'High', summary: 'AI summary', stepsToReproduce: ['Open', 'Search'], expected: 'X', actual: 'Y', rootCause: 'Z' })) };
      o.phase = 'done'; break;
    }
    default: s.step--;
  }
}
app.listen(PORT, () => console.log(`Fake Devin API on http://localhost:${PORT} (work dir ${WORK})`));
