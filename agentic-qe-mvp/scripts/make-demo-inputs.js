'use strict';
// Writes demo-inputs/: the Flow 1 and Flow 2 inputs as plain files a presenter can download,
// then paste or upload on the Run page instead of pulling them from GitHub.
const fs = require('fs');
const path = require('path');
const { loadCodebaseFixture } = require('../src/connectors/codebase');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'demo-inputs');
const jira = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', 'jira', f), 'utf8'));
const epicWithStories = (...keys) => ({ issues: keys.flatMap((key) => [jira(`${key}.json`), ...jira(`${key}.children.json`).issues]) });
const RELEASE_2 = (...keys) => epicWithStories(...keys.map((k) => `release-2.0/${k}`));
const HOTEL_EPICS = ['AQPI-2', 'AQPI-6', 'AQPI-10', 'AQPI-14', 'AQPI-18', 'AQPI-23', 'AQPI-27'];
const codebaseNotes = (branch) => loadCodebaseFixture(branch).files.map((f) => `# ${f.path}\n${f.text}`).join('\n\n');

const FLOWS = [
  { dir: 'flow-1-hotel-booking', branch: 'demo/hotel-booking-platform', files: [
    ['01-jira-initiative-AQPI-1.json', 'initiative', () => jira('AQPI-1.json')],
    ['02-jira-epics-AQPI-2-to-AQPI-27.json', 'epic', () => epicWithStories(...HOTEL_EPICS)],
    ['03-codebase-hotel-booking-platform.md', 'codebase', () => codebaseNotes('demo/hotel-booking-platform')],
  ] },
  { dir: 'flow-2-hotel-release-2', branch: 'demo/hotel-booking-platform-v2', files: [
    ['01-jira-epics-AQPI-32-AQPI-23.json', 'epic', () => RELEASE_2('AQPI-32', 'AQPI-23')],
    ['02-codebase-hotel-booking-platform-v2.md', 'codebase', () => codebaseNotes('demo/hotel-booking-platform-v2')],
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
