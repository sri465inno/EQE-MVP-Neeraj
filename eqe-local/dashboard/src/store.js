'use strict';
// File-based JSON persistence: one folder per run under DATA_DIR/runs.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data', 'dashboard');
const RUNS = path.join(DATA_DIR, 'runs');
fs.mkdirSync(RUNS, { recursive: true });

const runDir = (id) => path.join(RUNS, id);
const runFile = (id) => path.join(runDir(id), 'run.json');

function listRuns() {
  return fs.readdirSync(RUNS).filter((d) => fs.existsSync(runFile(d)))
    .map((d) => JSON.parse(fs.readFileSync(runFile(d), 'utf8')))
    .sort((a, b) => Number(b.id.split('-')[1]) - Number(a.id.split('-')[1]));
}
function getRun(id) { return fs.existsSync(runFile(id)) ? JSON.parse(fs.readFileSync(runFile(id), 'utf8')) : null; }
function saveRun(run) {
  run.updatedAt = new Date().toISOString();
  fs.mkdirSync(runDir(run.id), { recursive: true });
  const tmp = runFile(run.id) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(run, null, 2));
  fs.renameSync(tmp, runFile(run.id));
  return run;
}
function nextId() {
  const n = fs.readdirSync(RUNS).map((d) => Number((d.match(/^RUN-(\d+)$/) || [])[1] || 0));
  return `RUN-${Math.max(0, ...n) + 1}`;
}
module.exports = { ROOT, DATA_DIR, RUNS, runDir, listRuns, getRun, saveRun, nextId };
