'use strict';
// Devin API v3 client for the Devin engine. Credentials come from the environment and are never logged.
const fs = require('fs');
const path = require('path');

const base = () => (process.env.DEVIN_API_URL || 'https://api.devin.ai').trim().replace(/\/+$/, '').replace(/\/v[13]$/, '');
const org = () => (process.env.DEVIN_ORG_ID || '').trim();
const configured = () => !!(process.env.DEVIN_API_KEY && org());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, p, { json, form, retry = method === 'GET' } = {}) {
  if (!configured()) throw new Error('Devin API is not configured: set DEVIN_API_KEY and DEVIN_ORG_ID (see .env.example)');
  const url = `${base()}/v3/organizations/${encodeURIComponent(org())}${p}`;
  const headers = { Authorization: `Bearer ${process.env.DEVIN_API_KEY.trim()}`, Accept: 'application/json' };
  let body;
  if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); } else if (form) body = form;
  for (let attempt = 1; ; attempt++) {
    let res;
    try { res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(120_000) }); } catch (e) {
      if (retry && attempt < 4) { await sleep(2000 * attempt); continue; }
      throw new Error(`Devin API ${method} ${p}: ${e.message}`);
    }
    if (retry && (res.status === 429 || res.status >= 500) && attempt < 4) { await sleep(3000 * attempt); continue; }
    const text = await res.text();
    if (!res.ok) {
      let d = text;
      try { const j = JSON.parse(text); d = j.detail || j.title || text; if (typeof d !== 'string') d = JSON.stringify(d); } catch { /* not JSON */ }
      throw Object.assign(new Error(`Devin API ${method} ${p} returned ${res.status}: ${String(d).slice(0, 300)}`), { status: res.status });
    }
    return text ? JSON.parse(text) : null;
  }
}

async function uploadAttachment(file) {
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(file)]), path.basename(file));
  return call('POST', '/attachments', { form: fd });
}
const createSession = (body) => call('POST', '/sessions', { json: body });
const getSession = (id) => call('GET', `/sessions/${encodeURIComponent(id)}`);
const sendMessage = (id, message) => call('POST', `/sessions/${encodeURIComponent(id)}/messages`, { json: { message }, retry: true });
// The endpoint returns a bare array on some deployments and { items } on others.
const listAttachments = async (id) => { const r = await call('GET', `/sessions/${encodeURIComponent(id)}/attachments`); return Array.isArray(r) ? r : r?.items || []; };

// Session attachments: the API answers 307 with a presigned storage URL, which is fetched without credentials.
async function downloadAttachment(att, dest) {
  if (!configured()) throw new Error('Devin API is not configured');
  const url = `${base()}/v3/organizations/${encodeURIComponent(org())}/attachments/${encodeURIComponent(att.attachment_id)}/${encodeURIComponent(att.name)}`;
  const r = await fetch(url, { redirect: 'manual', headers: { Authorization: `Bearer ${process.env.DEVIN_API_KEY.trim()}` }, signal: AbortSignal.timeout(120_000) });
  let res = r;
  if (r.status >= 300 && r.status < 400 && r.headers.get('location')) res = await fetch(r.headers.get('location'), { signal: AbortSignal.timeout(600_000) });
  if (!res.ok) throw new Error(`Download of ${att.name} failed with ${res.status}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

module.exports = { configured, base, org, call, uploadAttachment, createSession, getSession, sendMessage, listAttachments, downloadAttachment };
