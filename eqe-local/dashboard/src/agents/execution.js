'use strict';
// Execution agent: runs the generated Playwright specs headless against the app and maps results back to test cases.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { ROOT, RUNS, runDir } = require('../store');

const strip = (s) => String(s || '').replace(/\u001b\[[0-9;]*m/g, '');
function collect(suite, out = []) {
  for (const sp of suite.specs || []) out.push({ ...sp, file: sp.file || suite.file });
  for (const s of suite.suites || []) collect(s, out);
  return out;
}
function failedStep(steps) {
  for (const s of steps || []) { if (s.error) return failedStep(s.steps) || s.title; }
  return null;
}

module.exports = async function execution(run, { log, setChild, progress = () => {} }) {
  const dir = path.join(runDir(run.id), run.scripts.dir);
  fs.rmSync(path.join(dir, 'results'), { recursive: true, force: true });
  fs.rmSync(path.join(dir, 'report'), { recursive: true, force: true });
  fs.rmSync(path.join(dir, 'live'), { recursive: true, force: true });
  const started = new Date().toISOString();
  const slowMo = run.config.slowMo ? 350 : 0; const workers = run.config.slowMo ? 2 : 4;
  log(`Running ${run.scripts.cases.length} specs with Playwright (chromium, headless, ${workers} workers${slowMo ? `, slow motion ${slowMo} ms` : ''}) against ${run.config.appUrl} · live view, video and trace on`);
  let lastLines = [];
  const total = run.scripts.cases.length; let finished = 0;
  progress(2, `Starting Playwright: 0 of ${total} specs run`);
  const code = await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js'), 'test', '--config', 'playwright.config.ts'],
      { cwd: dir, env: { ...process.env, NODE_PATH: path.join(ROOT, 'node_modules'), BASE_URL: run.config.appUrl, LIVE_DIR: path.join(dir, 'live'), SLOW_MO: String(slowMo), WORKERS: String(workers), FORCE_COLOR: '0', CI: '1' } });
    setChild && setChild(p);
    let buf = ''; let tail = [];
    const onData = (d) => {
      buf += d.toString();
      const lines = buf.split('\n'); buf = lines.pop();
      tail = tail.concat(lines.map(strip).filter(Boolean)).slice(-6);
      for (const l of lines.map(strip)) {
        const m = l.match(/^\s*([✓✘-]|ok|x)\s+\d+\s+.*?›\s+(TC-\d+)[^@]*?(@|\(|$).*?(\([\d.]+m?s\))?\s*$/);
        if (m) progress((95 * ++finished) / total, `${finished} of ${total} specs run`);
        if (m) log(`${m[2]} ${m[1] === '✓' || m[1] === 'ok' ? 'passed' : m[1] === '-' ? 'skipped' : 'FAILED'} ${m[4] || ''}`.trim(), m[1] === '✘' || m[1] === 'x' ? 'error' : 'info');
        else if (/^\s+\d+ (passed|failed|skipped|flaky)/.test(l)) log(l.trim());
      }
    };
    p.stdout.on('data', onData); p.stderr.on('data', onData);
    p.on('error', reject); p.on('close', (c) => { lastLines = tail; resolve(c); });
  });
  const file = path.join(dir, 'results', 'results.json');
  if (!fs.existsSync(file)) throw new Error(`Playwright exited with ${code} and produced no results: ${lastLines.join(' | ')}`);
  run.execution = { startedAt: started, finishedAt: new Date().toISOString(), exitCode: code, browser: 'chromium (headless)', slowMo, workers, baseUrl: run.config.appUrl, ...parseResults(run, dir) };
  const e = run.execution;
  return `${e.passed} passed · ${e.failed} failed · ${e.skipped} skipped in ${(e.durationMs / 1000).toFixed(1)}s`;
};

// Maps a Playwright JSON report to test case results. `remap` rebases attachment paths written on another machine (the Devin session).
function parseResults(run, dir, { remap = false } = {}) {
  const json = JSON.parse(fs.readFileSync(path.join(dir, 'results', 'results.json'), 'utf8'));
  const specs = (json.suites || []).flatMap((s) => collect(s));
  const local = (p) => { if (!p) return p; if (!remap) return p; const i = p.replace(/\\/g, '/').lastIndexOf('/results/'); return i >= 0 ? path.join(dir, p.replace(/\\/g, '/').slice(i + 1)) : p; };
  const url = (p) => { p = local(p); if (!p) return null; const abs = path.isAbsolute(p) ? p : path.join(dir, p); return remap && !fs.existsSync(abs) ? null : '/artifacts/' + path.relative(RUNS, abs).split(path.sep).join('/'); };
  const results = specs.map((sp) => {
    const t = sp.tests[0] || {}; const r = (t.results || [])[t.results.length - 1] || {};
    const status = t.status === 'skipped' || r.status === 'skipped' ? 'skipped' : r.status === 'passed' ? 'passed' : 'failed';
    const att = (n) => url((r.attachments || []).find((a) => a.name === n)?.path);
    return {
      tcId: (sp.title.match(/^(TC-\d+)/) || [])[1], title: sp.title, file: sp.file, status, durationMs: r.duration || 0,
      error: r.error ? strip(r.error.message).split('\n').slice(0, 8).join('\n') : null,
      failedStep: failedStep(r.steps), screenshot: att('screenshot'), trace: att('trace'), video: att('video'), testId: sp.id,
    };
  });
  const s = json.stats || {};
  const report = path.join(dir, 'report', 'index.html');
  return {
    passed: results.filter((r) => r.status === 'passed').length, failed: results.filter((r) => r.status === 'failed').length,
    skipped: results.filter((r) => r.status === 'skipped').length, durationMs: Math.round(s.duration || 0), results,
    htmlReport: fs.existsSync(report) || !remap ? url(report) : null,
  };
}
module.exports.parseResults = parseResults;
