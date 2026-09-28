'use strict';
// Deterministic statement extraction from Jira ADF, pasted text and codebase notes.
// Convention: every ADF/markdown bullet is one requirement statement; in source files,
// every "@rule" tag is one statement.

function adfText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  if (node.type === 'hardBreak') return ' ';
  return (node.content || []).map(adfText).join('');
}

function adfBullets(node, out = []) {
  if (!node) return out;
  if (node.type === 'listItem') {
    const t = adfText(node).replace(/\s+/g, ' ').trim();
    if (t) out.push(t);
    return out;
  }
  (node.content || []).forEach((c) => adfBullets(c, out));
  return out;
}

const ROLE_BY_LEVEL = { 2: 'initiative', 1: 'epic', 0: 'story' };

function statementsFromIssue(issue, { baseUrl, input }) {
  const role = ROLE_BY_LEVEL[issue.fields?.issuetype?.hierarchyLevel] || String(issue.fields?.issuetype?.name || 'issue').toLowerCase();
  return adfBullets(issue.fields?.description).map((text) => ({
    text, source: 'jira', input,
    origin: { kind: `jira-${role}`, ref: issue.key, summary: issue.fields?.summary, url: `${baseUrl}/browse/${issue.key}` },
    quote: text,
  }));
}

const BULLET = /^\s*(?:[-*+]|\d+[.)])\s+(.*\S)\s*$/;

function statementsFromPlainText(text, { input, source, ref }) {
  return String(text || '').split(/\r?\n/).map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => line.trim() && !/^\s*#/.test(line))
    .map(({ line, n }) => {
      const m = line.match(BULLET);
      const t = (m ? m[1] : line).trim();
      return { text: t, source, input, origin: { kind: source === 'jira' ? 'jira-pasted' : 'code-pasted', ref, line: n }, quote: t };
    });
}

/** Parses pasted Jira content: issue JSON, search JSON, or one statement per line. */
function statementsFromPastedJira(text, { input, baseUrl = 'https://jira.invalid' }) {
  const trimmed = String(text || '').trim();
  if (trimmed.startsWith('{')) {
    const json = JSON.parse(trimmed);
    const issues = json.issues ? json.issues : [json];
    const base = json.self ? new URL(json.self).origin : baseUrl;
    return issues.flatMap((iss) => statementsFromIssue(iss, { baseUrl: base, input }));
  }
  return statementsFromPlainText(trimmed, { input, source: 'jira', ref: `pasted ${input}` });
}

const RULE_HEADING = /(rule|behaviou?r|requirement|acceptance)/i;

function statementsFromMarkdown(md, { path, url, input }) {
  const out = [];
  let inRules = false;
  const hasRuleHeading = /^#{1,6}\s.*(rule|behaviou?r|requirement|acceptance)/im.test(md);
  md.split(/\r?\n/).forEach((line, i) => {
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (h) { inRules = RULE_HEADING.test(h[1]); return; }
    const m = line.match(BULLET);
    if (m && (inRules || !hasRuleHeading)) {
      out.push({ text: m[1].trim(), source: 'code', input, origin: { kind: 'code-readme', ref: path, line: i + 1, url }, quote: line.trim() });
    }
  });
  return out;
}

function statementsFromSource(src, { path, url, input }) {
  const out = [];
  src.split(/\r?\n/).forEach((line, i) => {
    const m = line.match(/@rule\s+(.*\S)\s*(?:\*\/)?\s*$/);
    if (m) out.push({ text: m[1].replace(/\*\/$/, '').trim(), source: 'code', input, origin: { kind: 'code-source', ref: path, line: i + 1, url }, quote: line.trim() });
  });
  return out;
}

function statementsFromCodebase(codebase, { input = 'codebase' } = {}) {
  return codebase.files.flatMap((f) => (/\.(md|markdown|txt)$/i.test(f.path)
    ? statementsFromMarkdown(f.text, { path: f.path, url: f.url, input })
    : statementsFromSource(f.text, { path: f.path, url: f.url, input })));
}

/** Pasted codebase: README/notes markdown plus any "@rule" lines. */
function statementsFromPastedCodebase(text, { input = 'codebase' } = {}) {
  const md = statementsFromMarkdown(String(text || '').split(/\r?\n/).filter((l) => !/@rule/.test(l)).join('\n'), { path: 'pasted notes', input });
  const src = statementsFromSource(String(text || ''), { path: 'pasted notes', input });
  return [...md, ...src];
}

module.exports = {
  adfText, adfBullets, statementsFromIssue, statementsFromPastedJira,
  statementsFromCodebase, statementsFromPastedCodebase, statementsFromMarkdown, statementsFromSource,
};
