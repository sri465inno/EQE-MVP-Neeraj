'use strict';
const fs = require('fs');
const path = require('path');

const FIXTURE_DIR = path.join(__dirname, '..', '..', 'fixtures', 'github');
const BRANCH_DIRS = { main: 'main', 'feature/booking-date-changes': 'feature-booking-date-changes' };

const decode = (contents) => Buffer.from(contents.content.replace(/\n/g, ''), contents.encoding || 'base64').toString('utf8');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function listFixtureBranches() {
  return Object.keys(BRANCH_DIRS);
}

/** Loads a codebase from the recorded GitHub API fixtures (repo, branch, README, source contents). */
function loadCodebaseFixture(branchName = 'main') {
  const dirName = BRANCH_DIRS[branchName];
  if (!dirName) throw new Error(`No recorded codebase fixture for branch "${branchName}"`);
  const dir = path.join(FIXTURE_DIR, dirName);
  const repo = readJson(path.join(dir, 'repo.json'));
  const branch = readJson(path.join(dir, 'branch.json'));
  const readme = readJson(path.join(dir, 'readme.json'));
  const srcDir = path.join(dir, 'contents', 'src');
  const sources = fs.readdirSync(srcDir).filter((f) => f.endsWith('.json')).sort().map((f) => readJson(path.join(srcDir, f)));
  const compareFile = path.join(dir, 'compare.json');
  const compare = fs.existsSync(compareFile) ? readJson(compareFile) : null;
  return {
    repo: repo.full_name,
    branch: branch.name,
    commit: branch.commit.sha,
    commitMessage: branch.commit.commit.message,
    description: repo.description,
    files: [
      { path: readme.path, url: readme.html_url, text: decode(readme) },
      ...sources.map((s) => ({ path: s.path, url: s.html_url, text: decode(s) })),
    ],
    compare: compare ? { status: compare.status, aheadBy: compare.ahead_by, files: compare.files.map((f) => ({ filename: f.filename, status: f.status })) } : null,
    provenance: {
      kind: 'fixture',
      label: `Recorded fixture (GitHub REST API shape) for ${repo.full_name}@${branch.name} - no live GitHub call was made`,
      ref: `${repo.full_name}@${branch.name} (${branch.commit.sha.slice(0, 7)})`,
      files: ['repo.json', 'branch.json', 'readme.json', ...sources.map((s) => `contents/${s.path}.json`), ...(compare ? ['compare.json'] : [])].map((f) => `fixtures/github/${dirName}/${f}`),
    },
  };
}

module.exports = { loadCodebaseFixture, listFixtureBranches };
