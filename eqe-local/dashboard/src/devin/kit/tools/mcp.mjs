#!/usr/bin/env node
// EQE Playwright MCP bridge for the Devin session.
//   node tools/mcp.mjs serve                          keep one Playwright MCP browser session open
//   node tools/mcp.mjs tools                          list the Playwright MCP tools
//   node tools/mcp.mjs call TC-001 browser_snapshot '{}'   run one MCP tool for a test case
// Every call is appended to results/mcp-calls.jsonl, which the EQE dashboard counts per test case.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { chromium } from '@playwright/test';

const PORT = Number(process.env.EQE_MCP_PORT || 8931);
const LOG = path.resolve('results/mcp-calls.jsonl');
const [cmd, ...rest] = process.argv.slice(2);
const usage = () => { console.error("usage: node tools/mcp.mjs serve | tools | call <TC-xxx> <tool> '<json args>'"); process.exit(2); };

if (cmd === 'serve') {
  const client = new Client({ name: 'eqe-devin-explorer', version: '1.0.0' });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve('node_modules/@playwright/mcp/cli.js'), '--headless', '--isolated', '--browser', 'chromium', '--caps', 'testing',
      '--output-dir', path.resolve('results/mcp-output'), '--viewport-size', '1280,900',
      ...(fs.existsSync(chromium.executablePath()) ? ['--executable-path', chromium.executablePath()] : [])],
    stderr: 'ignore',
  }));
  const tools = (await client.listTools()).tools.map((t) => ({ name: t.name, description: (t.description || '').split('\n')[0] }));
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  let queue = Promise.resolve();
  http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (req.url === '/tools') return res.end(JSON.stringify(tools));
      let msg;
      try { msg = JSON.parse(body || '{}'); } catch { res.statusCode = 400; return res.end('### Error\nBody is not JSON'); }
      queue = queue.then(async () => {
        const t0 = Date.now(); let r; let err;
        try { r = await client.callTool({ name: msg.tool, arguments: msg.args || {} }); } catch (e) { err = e.message; }
        const text = r ? (r.content || []).map((c) => c.text || '').join('\n') : `### Error\n${err}`;
        fs.appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), tc: msg.tc, tool: msg.tool, args: msg.args || {}, ok: !!r && !r.isError, ms: Date.now() - t0 }) + '\n');
        res.end(text);
      });
    });
  }).listen(PORT, '127.0.0.1', () => console.log(`EQE MCP bridge on http://127.0.0.1:${PORT}: ${tools.length} Playwright MCP tools`));
} else if (cmd === 'tools') {
  for (const t of await (await fetch(`http://127.0.0.1:${PORT}/tools`)).json()) console.log(`${t.name}\t${t.description}`);
} else if (cmd === 'call') {
  const [tc, tool, json] = rest;
  if (!/^TC-\d{3}$/.test(tc || '') || !tool) usage();
  const r = await fetch(`http://127.0.0.1:${PORT}/call`, { method: 'POST', body: JSON.stringify({ tc, tool, args: json ? JSON.parse(json) : {} }) });
  process.stdout.write(`${await r.text()}\n`);
} else usage();
