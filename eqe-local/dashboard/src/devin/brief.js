'use strict';
// Builds the per-cycle bundle uploaded to the Devin session and the prompt that starts it.
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { ROOT, runDir } = require('../store');

const TEMPLATE = {
  'package.json': JSON.stringify({ name: 'eqe-automation', private: true, devDependencies: { '@playwright/test': '1.63.0', '@playwright/mcp': '0.0.83', '@modelcontextprotocol/sdk': '1.32.1' } }, null, 2) + '\n',
  'playwright.config.ts': `import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 6_000 },
  fullyParallel: true,
  workers: Number(process.env.WORKERS || 4),
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'results/results.json' }], ['html', { outputFolder: 'report', open: 'never' }]],
  use: { baseURL: process.env.BASE_URL || 'http://localhost:4100', headless: true, viewport: { width: 1280, height: 800 }, screenshot: 'only-on-failure', trace: 'on', video: { mode: 'on', size: { width: 1280, height: 800 } }, launchOptions: { slowMo: Number(process.env.SLOW_MO || 0) } },
  outputDir: 'results/artifacts',
});
`,
  'support/fixtures.ts': `import { test as base, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/** Live view for the EQE dashboard: while LIVE_DIR is set, every test writes a frame of its browser a few times a second. */
export const test = base.extend<{ liveView: void }>({
  liveView: [async ({ page }, use, testInfo) => {
    const dir = process.env.LIVE_DIR;
    if (!dir) { await use(); return; }
    const id = (testInfo.title.match(/^TC-\\d+/) || ['test'])[0];
    fs.mkdirSync(dir, { recursive: true });
    const frame = path.join(dir, \`\${id}.jpg\`); const meta = path.join(dir, \`\${id}.json\`);
    const write = (status: string) => fs.writeFileSync(meta, JSON.stringify({ id, title: testInfo.title, status, url: page.url(), at: Date.now() }));
    let busy = false;
    const snap = async () => { if (busy) return; busy = true; try { await page.screenshot({ path: \`\${frame}.tmp\`, type: 'jpeg', quality: 60 }); fs.renameSync(\`\${frame}.tmp\`, frame); write('running'); } catch { /* page busy or closed */ } busy = false; };
    write('running'); const timer = setInterval(snap, 350); await use(); clearInterval(timer); await snap();
    write(testInfo.status === testInfo.expectedStatus ? 'passed' : 'failed');
  }, { auto: true }],
});
export { expect };
`,
  'support/test-data.ts': `import type { Locator } from '@playwright/test';

/** ISO date (YYYY-MM-DD) n days from today, so stays are always in the future. */
export const fromToday = (n: number): string => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Reads the first price shown in each list item (e.g. "$210"). */
export async function readPrices(list: Locator): Promise<number[]> {
  const texts = await list.getByRole('listitem').allInnerTexts();
  return texts.map((t) => Number((t.match(/\\$([\\d,.]+)/) || [])[1]?.replace(/,/g, '')));
}
`,
};

function cycleJson(run, criteria) {
  const bundled = !run.config.targetUrl;
  return {
    protocol: 'eqe-cycle/1', id: run.id, initiative: run.config.initiative, reviewer: run.config.reviewer,
    app: bundled ? { mode: 'bundled', name: 'StayEase', release: run.config.release || '1.0', url: 'http://localhost:4100' } : { mode: 'url', url: run.config.targetUrl, release: run.config.release || null },
    releaseCriteria: criteria, options: { autoApprove: !!run.config.autoApprove },
    documents: (run.config.documents || []).map((d) => ({ name: d.name, path: `requirements-docs/${d.file}`, type: d.type, size: d.size })),
  };
}

// Writes eqe-<id>-bundle.zip: protocol, automation template, raw Jira issues, cycle settings and (demo only) the StayEase app.
async function buildBundle(run, jiraIssues, criteria) {
  const dir = path.join(runDir(run.id), 'devin'); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `eqe-${run.id}-bundle.zip`);
  const cycle = cycleJson(run, criteria);
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(file); const zip = archiver('zip', { zlib: { level: 9 } });
    out.on('close', resolve); zip.on('error', reject); zip.pipe(out);
    zip.file(path.join(__dirname, 'kit', 'PROTOCOL.md'), { name: 'PROTOCOL.md' });
    for (const [n, src] of Object.entries(TEMPLATE)) zip.append(src, { name: `automation-template/${n}` });
    zip.file(path.join(__dirname, 'kit', 'tools', 'mcp.mjs'), { name: 'automation-template/tools/mcp.mjs' });
    zip.append(JSON.stringify(jiraIssues, null, 2), { name: 'jira/issues.json' });
    zip.append(JSON.stringify(cycle, null, 2), { name: 'cycle.json' });
    for (const d of run.config.documents || []) zip.file(path.join(runDir(run.id), 'docs', d.file), { name: `requirements-docs/${d.file}` });
    if (cycle.app.mode === 'bundled') {
      const app = path.join(ROOT, 'apps', 'stayease');
      for (const f of ['server.js', 'data.js']) zip.file(path.join(app, f), { name: `stayease/${f}` });
      zip.directory(path.join(app, 'public'), 'stayease/public');
      zip.append(JSON.stringify({ name: 'stayease', private: true, dependencies: { express: '^5.2.1' } }, null, 2), { name: 'stayease/package.json' });
    }
    zip.finalize();
  });
  fs.writeFileSync(path.join(dir, 'cycle.json'), JSON.stringify(cycle, null, 2));
  return { file, cycle };
}

function prompt(run, cycle, bundleName) {
  const app = cycle.app.mode === 'bundled' ? `the bundled StayEase ${cycle.app.release} demo app (start it inside this session)` : `the application at ${cycle.app.url}`;
  return [
    `EQE cycle ${run.id}: you are the Agentic Quality Engineering platform's agent session for Jira initiative ${run.config.initiative}, testing ${app}.`,
    '',
    `1. Unzip the attached ${bundleName} into ~/eqe-work and read ~/eqe-work/PROTOCOL.md completely. It is the contract with the EQE dashboard (protocol eqe-cycle/1).`,
    '2. Run the six agents in order (intake, analysis, test design, script generation, execution, reporting) exactly as PROTOCOL.md says.',
    '3. Report progress only through provide_structured_output, submitting the whole object after every stage (is_final=false until phase is done or failed).',
    `4. Stop at phase awaiting_test_approval and at phase awaiting_execution_review, and wait for the dashboard's EQE-APPROVAL / EQE-EXEC-REVIEW messages. ${run.config.reviewer} is the EQE lead.`,
    '5. Do not open repositories or pull requests, and do not ask questions in chat. Record open questions in the output.',
  ].join('\n');
}

module.exports = { buildBundle, prompt, TEMPLATE };
