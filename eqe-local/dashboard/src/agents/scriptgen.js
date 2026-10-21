'use strict';
// Script generation agent: drives the live app black-box through the Playwright MCP server, resolves each business term
// in the test steps to an element from the accessibility snapshot, harvests the Playwright code MCP ran,
// and writes Page Objects plus one Playwright spec per test case.
const fs = require('fs');
const path = require('path');
const { McpSession, textOf, ancestors } = require('../mcp');
const { GLOSSARY, LEVELS } = require('../catalog');
const { runDir } = require('../store');

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const words = (s) => norm(s).split(' ').filter(Boolean);
const camel = (s) => words(s).slice(0, 4).map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join('');
const pascal = (s) => words(s).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
const inst = (c) => c[0].toLowerCase() + c.slice(1);
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const isoPlus = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const ROLES = { fill: ['textbox', 'combobox', 'searchbox', 'spinbutton'], select: ['combobox', 'listbox'], list: ['list'] };
const SUFFIX = { textbox: 'Input', combobox: 'Field', searchbox: 'Input', spinbutton: 'Input', button: 'Button', link: 'Link', list: 'List', status: '' };

function resolve(nodes, term, roles, first = false) {
  const syns = (GLOSSARY[term] ? GLOSSARY[term].synonyms : [term]).map(norm);
  let best = null;
  for (const n of nodes) {
    if (!n.ref || (roles && !roles.includes(n.role))) continue;
    const name = norm(n.name); if (!name) continue;
    for (const syn of syns) {
      const score = name === syn ? 100 : name.startsWith(syn) ? 80 : name.includes(syn) ? 60 : syn.includes(name) && name.length > 3 ? 40 : 0;
      if (first && score < 80) continue;
      if (!score) continue;
      const rank = score + (roles && n.role === roles[0] ? 5 : 0) + (ancestors(n).some((a) => a.role === 'main') ? 2 : 0);
      if (!best || rank > best.rank) best = { node: n, syn, score, rank };
    }
  }
  return best;
}
function owner(url, node) {
  if (ancestors(node).some((a) => ['navigation', 'banner'].includes(a.role))) return 'HeaderComponent';
  const seg = (new URL(url).pathname.split('/').filter(Boolean)[0]) || 'home';
  return pascal(seg.replace(/-/g, ' ')) + 'Page';
}
const valueToMcp = (v, vars) => String(v).replace(/^\{\{date:\+(\d+)\}\}$/, (_, n) => isoPlus(Number(n))).replace(/\$\{(\w+)(\|lower)?\}/g, (_, k, lo) => (lo ? String(vars[k] ?? '').toLowerCase() : vars[k] ?? ''));
const valueToTs = (v) => (/^\{\{date:\+(\d+)\}\}$/.test(v) ? `fromToday(${v.match(/\d+/)[0]})` : /^\$\{(\w+)\|lower\}$/.test(v) ? `${v.slice(2, -7)}.toLowerCase()` : /^\$\{(\w+)\}$/.test(v) ? v.slice(2, -1) : q(v));
const locatorFromCode = (code) => { const l = (code || '').split('\n').find((x) => x.includes('page.')); const m = l && l.match(/^await (page\..+)\.(fill|click|selectOption|check|press|type)\(.*\);?$/); return m ? m[1] : null; };
const fallbackLocator = (n) => `page.getByRole(${q(n.role)}, { name: ${q(n.name)}, exact: true })`;

module.exports = async function scripts(run, { log, isCancelled, progress = () => {} }) {
  const appUrl = run.config.appUrl.replace(/\/$/, '');
  const dir = path.join(runDir(run.id), 'automation');
  fs.rmSync(dir, { recursive: true, force: true });
  for (const d of ['tests', 'pages', 'support']) fs.mkdirSync(path.join(dir, d), { recursive: true });
  const mcpDir = path.join(runDir(run.id), 'mcp');
  fs.mkdirSync(mcpDir, { recursive: true });

  const mcp = await new McpSession(mcpDir).start();
  log(`Connected to Playwright MCP server (${mcp.tools.length} tools: ${mcp.tools.filter((t) => /navigate|snapshot|click|type|select|generate_locator/.test(t)).join(', ')} …)`);
  const pages = {}; // class -> { props: { name: { locator, role, name, term } }, urls:Set }
  const register = (cls, prop, locator, meta) => {
    pages[cls] = pages[cls] || { props: {}, urls: new Set() };
    const P = pages[cls].props;
    let name = prop || 'element'; let i = 2;
    while (P[name] && P[name].locator !== locator) name = `${prop}${i++}`;
    P[name] = P[name] || { locator, ...meta };
    if (meta.url) pages[cls].urls.add(new URL(meta.url).pathname.replace(/\/[A-Z0-9]{6,}$/, '/:id').replace(/\/hotels\/[^/]+/, '/hotels/:id'));
    return name;
  };
  const cases = [];
  const todo = run.testCases.filter((c) => c.automation === 'Automation' && !(run.review?.excluded || []).includes(c.id));
  try {
    for (const [i, tc] of todo.entries()) {
      if (isCancelled()) throw new Error('Cancelled');
      progress((95 * i) / todo.length, `Scripting test case ${i + 1} of ${todo.length} (${tc.id})`);
      const t0 = Date.now(); const calls0 = mcp.calls;
      const vars = {}; const lines = []; const used = new Set(); const lets = new Set(); const stepsOut = []; const issues = [];
      log(`${tc.id}: exploring ${tc.steps.length} steps through MCP`);
      // Each generated spec runs in a fresh browser context, so start every exploration signed out with empty storage.
      if (mcp.tools.includes('browser_evaluate')) {
        await mcp.call('browser_navigate', { url: appUrl + '/' });
        await mcp.call('browser_evaluate', { function: '() => { localStorage.clear(); sessionStorage.clear(); }' });
      }
      for (const st of tc.steps) {
        const rec = { n: st.n, kind: st.kind, term: st.target || st.text || st.path, observed: 'ok' };
        const body = [];
        const act = async (roles, first, tool, extra) => {
          const { snap, hit } = await mcp.waitFor((s) => resolve(s.nodes, st.target, roles, first));
          if (!hit) throw new Error(`No element for "${st.target}" (${(roles || ['any']).join('/')}) on ${snap.url}`);
          const n = hit.node;
          const r = await mcp.call(tool, { element: `${st.target} (${n.role} "${n.name}")`, target: n.ref, ...extra });
          if (!r.ok) throw new Error(r.error);
          const cls = owner(snap.url, n);
          let loc = first ? `page.getByRole(${q(n.role)}, { name: /^${hit.syn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i }).first()` : (locatorFromCode(r.code) || fallbackLocator(n));
          const prop = register(cls, first ? `first${pascal(hit.syn)}${SUFFIX[n.role] ?? ''}` : `${camel(n.name)}${SUFFIX[n.role] ?? ''}`, loc, { role: n.role, name: n.name, term: st.target, url: snap.url });
          used.add(cls);
          Object.assign(rec, { resolvedTo: `${n.role} "${n.name}"`, match: hit.score === 100 ? 'exact' : `fuzzy (${hit.syn})`, locator: loc, page: cls, prop, tool, mcpCode: r.code });
          return `${inst(cls)}.${prop}`;
        };
        const locOnly = async (roles, first) => {
          const { snap, hit } = await mcp.waitFor((s) => resolve(s.nodes, st.target, roles, first));
          if (!hit) throw new Error(`No element for "${st.target}" on ${snap.url}`);
          const n = hit.node; const cls = owner(snap.url, n);
          let loc;
          if (first) loc = `page.getByRole(${q(n.role)}, { name: /^${hit.syn}/i }).first()`;
          else {
            const g = await mcp.call('browser_generate_locator', { element: `${st.target} (${n.role} "${n.name}")`, target: n.ref });
            const m = g.text.match(/((?:page\.)?(?:getBy\w+|locator)\([^\n`]*\))/);
            loc = m ? (m[1].startsWith('page.') ? m[1] : 'page.' + m[1]) : fallbackLocator(n);
          }
          const prop = register(cls, first ? `first${pascal(hit.syn)}${SUFFIX[n.role] ?? ''}` : `${camel(n.name)}${SUFFIX[n.role] ?? ''}`, loc, { role: n.role, name: n.name, term: st.target, url: snap.url });
          used.add(cls);
          Object.assign(rec, { resolvedTo: `${n.role} "${n.name}"`, match: hit.score === 100 ? 'exact' : `fuzzy (${hit.syn})`, locator: loc, page: cls, prop });
          return { ref: `${inst(cls)}.${prop}`, node: n };
        };
        try {
          switch (st.kind) {
            case 'goto': { const r = await mcp.call('browser_navigate', { url: appUrl + st.path }); if (!r.ok) throw new Error(r.error); Object.assign(rec, { tool: 'browser_navigate', mcpCode: r.code }); body.push(`await page.goto(${q(st.path)});`); break; }
            case 'fill': { const ref = await act(ROLES.fill, false, 'browser_type', { text: valueToMcp(st.value, vars) }); body.push(`await ${ref}.fill(${valueToTs(st.value)});`); break; }
            case 'select': { const ref = await act(ROLES.select, false, 'browser_select_option', { values: [valueToMcp(st.value, vars)] }); body.push(`await ${ref}.selectOption(${valueToTs(st.value)});`); break; }
            case 'click': { const ref = await act([st.role, st.role === 'button' ? 'link' : 'button'], false, 'browser_click', {}); body.push(`await ${ref}.click();`); break; }
            case 'clickFirst': { const ref = await act([st.role, st.role === 'button' ? 'link' : 'button'], true, 'browser_click', {}); body.push(`await ${ref}.click();`); break; }
            case 'expectText': {
              const want = norm(valueToMcp(st.text, vars));
              const { hit } = await mcp.waitFor((s) => s.nodes.some((n) => norm(textOf(n)).includes(want)), 10);
              rec.observed = hit ? 'seen' : 'not seen'; rec.tool = 'browser_snapshot';
              body.push(`await expect(page.getByText(${valueToTs(st.text)}).first()).toBeVisible();`); break;
            }
            case 'expectVisibleFirst': { const { ref } = await locOnly([st.role, 'button', 'link'], true); rec.observed = 'seen'; body.push(`await expect(${ref}).toBeVisible();`); break; }
            case 'capture': {
              const { ref, node } = await locOnly(null, false);
              vars[st.as] = node.value || textOf(node).replace(node.name, '').trim();
              rec.observed = `captured "${vars[st.as]}"`; lets.add(st.as);
              body.push(`${st.as} = (await ${ref}.textContent())?.trim() ?? '';`, `expect(${st.as}).not.toBe('');`); break;
            }
            case 'expectSorted': {
              const { ref, node } = await locOnly(ROLES.list, false);
              const prices = node.children.filter((c) => c.role === 'listitem').map((c) => Number(((textOf(c).match(/\$([\d,.]+)/) || [])[1] || '').replace(/,/g, '')));
              const sorted = [...prices].sort((a, b) => (st.order === 'asc' ? a - b : b - a));
              rec.observed = `${prices.join(', ')} → ${JSON.stringify(prices) === JSON.stringify(sorted) ? 'in order' : 'NOT in order'}`;
              body.push(`const prices = await readPrices(${ref});`, 'expect(prices.length).toBeGreaterThan(1);', `expect(prices).toEqual([...prices].sort((a, b) => ${st.order === 'asc' ? 'a - b' : 'b - a'}));`); break;
            }
            case 'expectEach': {
              const { ref, node } = await locOnly(ROLES.list, false);
              const items = node.children.filter((c) => c.role === 'listitem').map(textOf);
              const bad = items.filter((t) => !norm(t).includes(norm(st.text)));
              rec.observed = `${items.length} items, ${bad.length} without "${st.text}"`;
              body.push(`const items = await ${ref}.getByRole('listitem').allInnerTexts();`, 'expect(items.length).toBeGreaterThan(0);', `for (const item of items) expect(item).toContain(${q(st.text)});`); break;
            }
            default: throw new Error(`Unsupported step kind ${st.kind}`);
          }
        } catch (e) {
          rec.observed = 'unresolved'; rec.error = e.message; issues.push(`Step ${st.n}: ${e.message}`);
          body.push(`// UNRESOLVED: ${e.message.replace(/\n/g, ' ')}`);
        }
        if (/not seen|NOT in order|[1-9]\d* without/.test(rec.observed)) rec.mismatch = true;
        stepsOut.push(rec);
        const label = st.expected ? `${st.action}: ${st.expected}` : st.action;
        lines.push(`  await test.step(${q(`${st.n}. ${label}`)}, async () => {`, ...body.map((b) => `    ${b}`), '  });');
      }
      const file = `${tc.id}.spec.ts`;
      const imports = [...used].sort().map((c) => `import { ${c} } from '../pages/${kebab(c).replace(/-(page|component)$/, '.$1')}';`);
      const helpers = ['fromToday', 'readPrices'].filter((h) => lines.some((l) => l.includes(h + '(')));
      const fn = issues.length ? 'test.fixme' : 'test';
      const src = [
        `// ${tc.id} · ${tc.title}`, `// Requirements: ${tc.acIds.join(', ')}`, '// Generated by the EQE dashboard from a black-box Playwright MCP exploration of the live app.',
        "import { test, expect } from '../support/fixtures';", ...imports, ...(helpers.length ? [`import { ${helpers.join(', ')} } from '../support/test-data';`] : []), '',
        `${fn}(${q(`${tc.id} ${tc.title}`)}, { tag: [${[...tc.storyKeys.map((k) => `'@${k}'`), `'@${tc.priority}'`, `'@${tc.type.toLowerCase().replace(/\s+/g, '-')}'`].join(', ')}], annotation: [{ type: 'requirements', description: ${q(tc.acIds.join(', '))} }] }, async ({ page }) => {`,
        ...[...used].sort().map((c) => `  const ${inst(c)} = new ${c}(page);`), ...[...lets].map((v) => `  let ${v} = '';`), ...lines, '});', '',
      ].join('\n');
      fs.writeFileSync(path.join(dir, 'tests', file), src);
      const mism = stepsOut.filter((s) => s.mismatch).length;
      cases.push({ tcId: tc.id, file: `tests/${file}`, status: issues.length ? 'needs-attention' : 'generated', issues, steps: stepsOut, mcpCalls: mcp.calls - calls0, ms: Date.now() - t0, dryRunMismatches: mism });
      log(`${tc.id}: ${issues.length ? `needs attention (${issues[0]})` : 'script generated'} · ${mcp.calls - calls0} MCP calls${mism ? ` · ${mism} expectation(s) not met during exploration (possible defect)` : ''}`, issues.length ? 'warn' : mism ? 'warn' : 'info');
    }
  } finally { await mcp.close(); }

  // Page objects
  const pageFiles = [];
  for (const [cls, p] of Object.entries(pages)) {
    const file = `pages/${kebab(cls).replace(/-(page|component)$/, '.$1')}.ts`;
    const props = Object.entries(p.props);
    const src = ["import type { Locator, Page } from '@playwright/test';", '', `/** ${cls === 'HeaderComponent' ? 'Site header and main navigation' : `Page at ${[...p.urls].join(', ')}`}. Locators discovered by Playwright MCP from the accessibility tree. */`,
      `export class ${cls} {`, '  readonly page: Page;', ...props.map(([n]) => `  readonly ${n}: Locator;`), '', '  constructor(page: Page) {', '    this.page = page;',
      ...props.map(([n, v]) => `    this.${n} = ${v.locator};`), '  }', '}', ''].join('\n');
    fs.writeFileSync(path.join(dir, file), src);
    pageFiles.push({ class: cls, file, urls: [...p.urls], locators: props.map(([n, v]) => ({ prop: n, locator: v.locator, role: v.role, name: v.name, term: v.term })) });
  }
  fs.writeFileSync(path.join(dir, 'support', 'test-data.ts'), [
    "import type { Locator } from '@playwright/test';", '',
    '/** ISO date (YYYY-MM-DD) n days from today, so stays are always in the future. */',
    'export const fromToday = (n: number): string => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };', '',
    '/** Reads the first price shown in each list item (e.g. "$210"). */',
    'export async function readPrices(list: Locator): Promise<number[]> {',
    "  const texts = await list.getByRole('listitem').allInnerTexts();",
    "  return texts.map((t) => Number((t.match(/\\$([\\d,.]+)/) || [])[1]?.replace(/,/g, '')));", '}', ''].join('\n'));
  fs.writeFileSync(path.join(dir, 'support', 'fixtures.ts'), [
    "import { test as base, expect } from '@playwright/test';", "import * as fs from 'fs';", "import * as path from 'path';", '',
    '/** Live view: while LIVE_DIR is set, every test writes a frame of its browser a few times a second for the dashboard. */',
    'export const test = base.extend<{ liveView: void }>({',
    '  liveView: [async ({ page }, use, testInfo) => {',
    '    const dir = process.env.LIVE_DIR;',
    '    if (!dir) { await use(); return; }',
    "    const id = (testInfo.title.match(/^TC-\\d+/) || ['test'])[0];",
    '    fs.mkdirSync(dir, { recursive: true });',
    "    const frame = path.join(dir, `${id}.jpg`); const meta = path.join(dir, `${id}.json`);",
    "    const write = (status: string) => fs.writeFileSync(meta, JSON.stringify({ id, title: testInfo.title, status, url: page.url(), at: Date.now() }));",
    '    let busy = false;',
    "    const snap = async () => { if (busy) return; busy = true; try { await page.screenshot({ path: `${frame}.tmp`, type: 'jpeg', quality: 60 }); fs.renameSync(`${frame}.tmp`, frame); write('running'); } catch { /* page busy or closed */ } busy = false; };",
    "    write('running');", '    const timer = setInterval(snap, 350);', '    await use();', '    clearInterval(timer); await snap();',
    "    write(testInfo.status === testInfo.expectedStatus ? 'passed' : 'failed');",
    '  }, { auto: true }],', '});', 'export { expect };', ''].join('\n'));
  fs.writeFileSync(path.join(dir, 'playwright.config.ts'), [
    "import { defineConfig } from '@playwright/test';", '',
    'export default defineConfig({',
    "  testDir: './tests',", '  timeout: 90_000,', '  expect: { timeout: 6_000 },', '  fullyParallel: true,', '  workers: Number(process.env.WORKERS || 4),', '  retries: 0,',
    "  reporter: [['list'], ['json', { outputFile: 'results/results.json' }], ['html', { outputFolder: 'report', open: 'never' }]],",
    `  use: { baseURL: process.env.BASE_URL || ${q(appUrl)}, headless: true, viewport: { width: 1280, height: 800 }, screenshot: 'only-on-failure', trace: 'on', video: { mode: 'on', size: { width: 1280, height: 800 } }, launchOptions: { slowMo: Number(process.env.SLOW_MO || 0) } },`,
    "  outputDir: 'results/artifacts',", '});', ''].join('\n'));
  fs.writeFileSync(path.join(mcpDir, 'transcript.json'), JSON.stringify(mcp.transcript, null, 2));

  run.scripts = {
    dir: path.relative(runDir(run.id), dir), mcpTools: mcp.tools, mcpCalls: mcp.calls, cases, pageObjects: pageFiles,
    generated: cases.filter((c) => c.status === 'generated').length, needsAttention: cases.filter((c) => c.status !== 'generated').length,
    locators: pageFiles.reduce((n, p) => n + p.locators.length, 0), dryRunMismatches: cases.reduce((n, c) => n + c.dryRunMismatches, 0),
  };
  for (const c of cases) { const t = run.testCases.find((x) => x.id === c.tcId); if (t && c.status === 'generated') t.level = [t.origin === 'user' ? LEVELS.user : LEVELS.rules, LEVELS.automated].join(', '); }
  const s = run.scripts;
  return `${s.generated} scripts generated${s.needsAttention ? `, ${s.needsAttention} need attention` : ''} · ${pageFiles.length} page objects · ${s.locators} locators · ${s.mcpCalls} MCP calls`;
};
