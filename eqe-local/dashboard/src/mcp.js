'use strict';
// Thin client for the Playwright MCP server (stdio). The script generator drives the app only through MCP tools.
const path = require('path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { ROOT } = require('./store');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Parse a Playwright MCP aria snapshot (YAML) into a flat node list with ancestry.
function parseSnapshot(yaml) {
  const nodes = []; const stack = [];
  for (const line of yaml.split('\n')) {
    const m = line.match(/^(\s*)- (\w+)(?: "((?:[^"\\]|\\.)*)")?([^:]*?)(?::\s*(.*))?$/);
    if (!m) continue;
    const indent = m[1].length;
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const ref = (m[4] || '').match(/\[ref=(\w+)\]/);
    const node = { role: m[2], name: (m[3] || '').replace(/\\"/g, '"'), ref: ref && ref[1], value: (m[5] || '').trim(), indent, parent: stack[stack.length - 1] || null, children: [] };
    if (node.parent) node.parent.children.push(node);
    nodes.push(node); stack.push(node);
  }
  return nodes;
}
const textOf = (n) => [n.name, n.value && !n.value.startsWith('/') ? n.value : '', ...n.children.map(textOf)].filter(Boolean).join(' ');
const ancestors = (n) => { const a = []; for (let p = n.parent; p; p = p.parent) a.push(p); return a; };

class McpSession {
  constructor(outputDir) { this.outputDir = outputDir; this.calls = 0; this.transcript = []; }
  async start() {
    this.transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(ROOT, 'node_modules', '@playwright', 'mcp', 'cli.js'), '--headless', '--isolated', '--browser', 'chromium', '--caps', 'testing', '--output-dir', this.outputDir, '--viewport-size', '1280,900'],
      cwd: ROOT, stderr: 'ignore',
    });
    this.client = new Client({ name: 'eqe-script-generator', version: '1.0.0' });
    await this.client.connect(this.transport);
    this.tools = (await this.client.listTools()).tools.map((t) => t.name);
    return this;
  }
  async call(name, args) {
    this.calls++;
    const r = await this.client.callTool({ name, arguments: args });
    const text = (r.content || []).map((c) => c.text || '').join('\n');
    const code = (text.match(/### Ran Playwright code\n```\w*\n([\s\S]*?)```/) || [])[1];
    const url = (text.match(/- Page URL: (.*)/) || [])[1];
    const entry = { tool: name, args, ok: !r.isError, code: code ? code.trim() : null, url, error: r.isError ? text.replace(/^### Error\n/, '').slice(0, 300) : null };
    this.transcript.push(entry);
    return { ...entry, text };
  }
  async snapshot() {
    const r = await this.call('browser_snapshot', {});
    const yaml = (r.text.match(/```yaml\n([\s\S]*?)```/) || [])[1] || '';
    return { url: r.url, yaml, nodes: parseSnapshot(yaml) };
  }
  // Re-snapshot until predicate finds something (SPA pages render after fetch).
  async waitFor(pred, tries = 12) {
    let snap;
    for (let i = 0; i < tries; i++) { snap = await this.snapshot(); const hit = pred(snap); if (hit) return { snap, hit }; await sleep(250); }
    return { snap, hit: null };
  }
  async close() { try { await this.client.close(); } catch { /* ignore */ } }
}
module.exports = { McpSession, parseSnapshot, textOf, ancestors, sleep };
