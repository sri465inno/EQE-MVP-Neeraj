'use strict';
const path = require('path');
const fs = require('fs');
const express = require('express');
const store = require('./src/store');
const jira = require('./src/jira');
const pipeline = require('./src/pipeline');
const devinClient = require('./src/devin/client');
const exportsLib = require('./src/exports');

const PORT = Number(process.env.PORT || 4000);
const APP_URL = process.env.APP_URL || 'http://localhost:4100';
const app = express();
app.use(express.json({ limit: '40mb' }));
app.use('/artifacts', express.static(store.RUNS));
app.use(express.static(path.join(__dirname, 'public')));

const summary = (r) => ({
  id: r.id, createdAt: r.createdAt, finishedAt: r.finishedAt, status: r.status, config: r.config,
  stages: r.stages.map(({ key, name, status, summary: s }) => ({ key, name, status, summary: s })),
  decision: r.report?.decision, passRate: r.report?.metrics.passRate, defects: r.report?.defects.length, release: r.report?.release, metrics: r.report?.metrics, reviewer: r.review?.approvedBy || r.config.reviewer,
  devin: r.devin ? { url: r.devin.url, phase: r.devin.phase, status: r.devin.status, acus: r.devin.acus } : undefined,
});
const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } };

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'eqe-dashboard' }));
app.get('/api/config', wrap(async (req, res) => {
  const out = { jiraUrl: jira.JIRA_URL, appUrl: APP_URL, stages: pipeline.STAGES.map(({ key, name, agent, gate }) => ({ key, name, agent, gate: !!gate })) };
  try { out.jira = await jira.serverInfo(); out.initiatives = (await jira.search('issuetype = Initiative ORDER BY key')).map((i) => ({ key: i.key, summary: i.fields.summary })); } catch (e) { out.jiraError = e.message; }
  try { out.app = await (await fetch(APP_URL + '/api/health')).json(); } catch (e) { out.appError = e.message; }
  out.devin = { configured: devinClient.configured(), apiUrl: devinClient.base() };
  out.criteria = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'release-criteria.json'), 'utf8'));
  res.json(out);
}));
app.get('/api/runs', (req, res) => res.json(store.listRuns().map(summary)));
app.post('/api/runs', wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.initiative) return res.status(400).json({ error: 'initiative is required' });
  if (!String(b.reviewer || '').trim()) return res.status(400).json({ error: 'A reviewer name is required' });
  const engine = b.engine === 'devin' ? 'devin' : 'rules';
  const used = new Set();
  const docs = (Array.isArray(b.documents) ? b.documents : []).filter((d) => d && d.name && d.data).map((d) => {
    let file = path.basename(String(d.name)).replace(/[^\w.\- ()]+/g, '_').slice(0, 120) || 'document';
    while (used.has(file)) file = `1-${file}`; used.add(file);
    const buf = Buffer.from(String(d.data), 'base64');
    return { name: String(d.name).slice(0, 200), file, size: buf.length, type: String(d.type || ''), buf };
  });
  if (docs.reduce((n, d) => n + d.size, 0) > 25 * 1024 * 1024) return res.status(400).json({ error: 'Requirement documents exceed 25 MB in total' });
  if (engine === 'devin' && !devinClient.configured()) return res.status(400).json({ error: 'The Devin engine needs DEVIN_API_KEY and DEVIN_ORG_ID in .env (see .env.example); restart the dashboard after setting them' });
  const run = pipeline.create({ initiative: b.initiative, appUrl: b.appUrl || APP_URL, release: b.release || null, reviewer: String(b.reviewer).trim(), flow: 'baseline', autoApprove: !!b.autoApprove && engine === 'devin', raiseDefects: b.raiseDefects !== false, slowMo: !!b.slowMo,
    engine, targetUrl: engine === 'devin' && b.targetUrl ? String(b.targetUrl).trim() : null, documents: docs.map(({ name, file, size, type }) => ({ name, file, size, type })) });
  if (docs.length) {
    const dir = path.join(store.runDir(run.id), 'docs'); fs.mkdirSync(dir, { recursive: true });
    for (const d of docs) fs.writeFileSync(path.join(dir, d.file), d.buf);
  }
  res.status(201).json(summary(run));
}));
app.get('/api/runs/:id', (req, res) => {
  const r = store.getRun(req.params.id);
  return r ? res.json({ ...r, active: pipeline.isActive(r.id) }) : res.status(404).json({ error: 'Run not found' });
});
const requireNote = (field) => (req, res, next) => (String((req.body || {})[field] || '').trim() ? next() : res.status(400).json({ error: 'A review note is required' }));
app.post('/api/runs/:id/approve', requireNote('note'), wrap(async (req, res) => res.json(summary(pipeline.approve(req.params.id, req.body || {})))));
app.post('/api/runs/:id/approve-execution', requireNote('note'), wrap(async (req, res) => res.json(summary(pipeline.approveExecution(req.params.id, req.body || {})))));
app.post('/api/runs/:id/testcases', wrap(async (req, res) => res.json(summary(pipeline.addTestCase(req.params.id, req.body || {})))));
app.post('/api/runs/:id/reject', requireNote('reason'), wrap(async (req, res) => res.json(summary(pipeline.reject(req.params.id, req.body || {})))));
const done = (req, res) => { const r = store.getRun(req.params.id); if (!r || !r.report) { res.status(404).json({ error: 'Report not available for this run' }); return null; } return r; };
const xlsx = (res, name, buf) => { res.set('content-disposition', `attachment; filename="${name}"`); res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(Buffer.from(buf)); };
app.get('/api/runs/:id/report.xlsx', wrap(async (req, res) => { const r = done(req, res); if (r) xlsx(res, `${r.id}-report.xlsx`, await exportsLib.reportXlsx(r)); }));
app.get('/api/runs/:id/export/testcases.xlsx', wrap(async (req, res) => { const r = store.getRun(req.params.id); if (!r || !r.testCases) return res.status(404).json({ error: 'No test cases yet' }); xlsx(res, `${r.id}-testcases.xlsx`, await exportsLib.testCasesXlsx(r)); }));
app.get('/api/runs/:id/lead-report.html', (req, res) => { const r = done(req, res); if (r) res.type('html').send(exportsLib.leadReportHtml(r)); });
app.get('/api/runs/:id/lead-report.md', (req, res) => {
  const p = path.join(store.runDir(req.params.id), 'test-summary.md');
  return fs.existsSync(p) ? res.set('content-disposition', `attachment; filename="${req.params.id}-lead-report.md"`).type('text/markdown').send(fs.readFileSync(p, 'utf8')) : res.status(404).end();
});
app.post('/api/runs/:id/rerun-execution', wrap(async (req, res) => res.json(summary(pipeline.rerunExecution(req.params.id, req.body || {})))));
app.get('/api/runs/:id/live', (req, res) => {
  const dir = path.join(store.runDir(req.params.id), 'automation', 'live');
  if (!fs.existsSync(dir)) return res.json([]);
  const out = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return null; } }).filter(Boolean)
    .map((m) => ({ ...m, frame: fs.existsSync(path.join(dir, `${m.id}.jpg`)) ? `/artifacts/${req.params.id}/automation/live/${m.id}.jpg?t=${m.at}` : null }))
    .sort((a, b) => a.id.localeCompare(b.id));
  res.json(out);
});
app.post('/api/runs/:id/cancel', wrap(async (req, res) => { const r = pipeline.cancel(req.params.id); return r ? res.json(summary(r)) : res.status(404).end(); }));
app.get('/api/runs/:id/files', wrap(async (req, res) => {
  const base = path.join(store.runDir(req.params.id), 'automation');
  if (!fs.existsSync(base)) return res.json([]);
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (['results', 'report', 'live'].includes(e.name) ? [] : walk(path.join(d, e.name))) : [path.relative(base, path.join(d, e.name)).split(path.sep).join('/')]));
  res.json(walk(base).sort());
}));
app.get('/api/runs/:id/file', wrap(async (req, res) => {
  const base = path.join(store.runDir(req.params.id), 'automation');
  const p = path.resolve(base, String(req.query.path || ''));
  if (!p.startsWith(base + path.sep) || !fs.existsSync(p)) return res.status(404).json({ error: 'File not found' });
  res.type('text/plain').send(fs.readFileSync(p, 'utf8'));
}));
app.get('/api/runs/:id/summary.md', (req, res) => {
  const p = path.join(store.runDir(req.params.id), 'test-summary.md');
  return fs.existsSync(p) ? res.type('text/markdown').send(fs.readFileSync(p, 'utf8')) : res.status(404).end();
});
// Demo reset: clears every cycle, restores the seeded Jira backlog and empties StayEase reservations (both releases).
app.post('/api/demo/reset', wrap(async (req, res) => {
  const busy = pipeline.activeIds();
  if (busy.length) return res.status(409).json({ error: `Wait for ${busy.join(', ')} to finish (or cancel it) before resetting the demo` });
  const removed = fs.readdirSync(store.RUNS).filter((d) => /^RUN-\d+$/.test(d));
  removed.forEach((d) => fs.rmSync(path.join(store.RUNS, d), { recursive: true, force: true }));
  const out = { cyclesRemoved: removed.length };
  try { out.jira = await (await fetch(`${jira.JIRA_URL}/ui/reset`, { method: 'POST' })).json(); } catch (e) { out.jiraError = e.message; }
  out.reservationsCleared = [];
  for (const d of ['stayease', 'stayease-1.1']) {
    const f = path.join(store.ROOT, 'data', d, 'reservations.json');
    if (fs.existsSync(f)) { out.reservationsCleared.push(`${d}: ${JSON.parse(fs.readFileSync(f, 'utf8')).length}`); fs.writeFileSync(f, '[]'); }
  }
  const b = req.body || {};
  if (b.rerun) {
    const reviewer = String(b.reviewer || 'EQE lead').trim();
    const initiative = (await jira.search('issuetype = Initiative ORDER BY key'))[0]?.key;
    if (!initiative) return res.status(500).json({ ...out, error: 'No initiative found in Jira after the reset' });
    out.started = [
      pipeline.create({ initiative, appUrl: 'http://localhost:4100', release: '1.0', reviewer, flow: 'baseline', autoApprove: true, raiseDefects: true }).id,
      pipeline.create({ initiative, appUrl: 'http://localhost:4101', release: '1.1', reviewer, flow: 'baseline', autoApprove: true, raiseDefects: true }).id,
    ];
  }
  res.json(out);
}));
app.get(/^\/(?!api|artifacts).*/, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

pipeline.recover();
app.listen(PORT, () => console.log(`EQE dashboard on http://localhost:${PORT} (Jira ${jira.JIRA_URL}, app ${APP_URL})`));
