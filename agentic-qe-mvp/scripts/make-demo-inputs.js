'use strict';
// Writes demo-inputs/: the Flow 1 and Flow 2 inputs as plain files a presenter can download,
// then paste or upload on the Run page instead of pulling them from GitHub.
const fs = require('fs');
const path = require('path');
const { loadCodebaseFixture } = require('../src/connectors/codebase');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'demo-inputs');
const jira = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', 'jira', f), 'utf8'));
const epicWithStories = (key) => ({ issues: [jira(`${key}.json`), ...jira(`${key}.children.json`).issues] });
const codebaseNotes = (branch) => loadCodebaseFixture(branch).files.map((f) => `# ${f.path}\n${f.text}`).join('\n\n');

const FLOWS = [
  { dir: 'flow-1-baseline', files: [
    ['01-jira-initiative-COM-1.json', 'initiative', () => jira('COM-1.json')],
    ['02-jira-epic-COM-10.json', 'epic', () => epicWithStories('COM-10')],
    ['03-codebase-commission-engine.md', 'codebase', () => codebaseNotes('demo/commission-engine')],
  ] },
  { dir: 'flow-2-incremental', files: [
    ['01-jira-epic-COM-20.json', 'epic', () => epicWithStories('COM-20')],
    ['02-codebase-commission-engine-v2.md', 'codebase', () => codebaseNotes('demo/commission-engine-v2')],
  ] },
];

function writeDemoInputs(out = OUT) {
  for (const flow of FLOWS) {
    fs.mkdirSync(path.join(out, flow.dir), { recursive: true });
    for (const [name, , make] of flow.files) {
      const body = make();
      fs.writeFileSync(path.join(out, flow.dir, name), typeof body === 'string' ? `${body.trimEnd()}\n` : `${JSON.stringify(body, null, 2)}\n`);
    }
  }
}

if (require.main === module) {
  writeDemoInputs();
  console.log(`Wrote ${FLOWS.reduce((n, f) => n + f.files.length, 0)} files to demo-inputs/`);
}

module.exports = { FLOWS, writeDemoInputs };
