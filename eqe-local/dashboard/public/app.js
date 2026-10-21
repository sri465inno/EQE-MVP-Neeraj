'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LEVELS = { agent: 'AI Generated', rules: 'Rule Generated', user: 'User Defined', automated: 'Automated' };
const levelsOf = (run, t) => [t.origin === 'user' ? LEVELS.user : t.engine === 'devin' ? LEVELS.agent : LEVELS.rules, ...((run.scripts?.cases || []).some((c) => c.tcId === t.id && c.status === 'generated') ? [LEVELS.automated] : [])];
const levelTip = (l, t) => (l === LEVELS.automated ? 'Playwright script generated for this test case' : l === LEVELS.user ? `Added by ${t.createdBy || 'a user'}` : 'Created by the Test design agent');
const levelPill = (run, t) => `<span class="levels">${levelsOf(run, t).map((l) => `<span class="pill lvl-${l.replace(/\s+/g, '-')}" title="${esc(levelTip(l, t))}">${esc(l)}</span>`).join('<span class="lvl-sep">,</span> ')}</span>`;
const pill = (s, label) => `<span class="pill ${esc(String(s).replace(/\s+/g, '-'))}">${esc(label ?? s)}</span>`;
const api = async (p, opt = {}) => { const r = await fetch(p, { ...opt, headers: { 'content-type': 'application/json' } }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.statusText); return j; };
const time = (t) => (t ? new Date(t).toLocaleTimeString() : '');
const when = (t) => (t ? new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '');
const dur = (a, b) => (a && b ? `${((new Date(b) - new Date(a)) / 1000).toFixed(1)}s` : '');
// Devin preview hosts are "<port>--<id>…"; locally use localhost:<port>.
const sibling = (port) => (/^\d+--/.test(location.hostname) ? `${location.protocol}//${location.hostname.replace(/^\d+--/, `${port}--`)}` : `${location.protocol}//${location.hostname}:${port}`);
const JIRA = sibling(4200); const APP = sibling(4100);
const jiraLink = (k) => `<a href="${JIRA}/?issue=${encodeURIComponent(k)}" target="_blank" rel="noopener">${esc(k)}</a>`;
const RELEASES = [
  { id: '1.0', url: 'http://localhost:4100', label: 'StayEase release 1.0', note: 'Current release' },
  { id: '1.1', url: 'http://localhost:4101', label: 'StayEase release 1.1', note: 'Candidate release with the Find reservation fix.' },
];
const AGENTS = [
  { key: 'intake', n: 1, name: 'Requirements agent', does: 'Reads the initiative, its epics, stories and acceptance criteria from Jira (REST v3).', makes: 'One requirement set: story by story, with acceptance criteria and Jira keys.' },
  { key: 'analysis', n: 2, name: 'Analysis agent', does: 'Classifies every acceptance criterion: testability, ambiguity, journey stage, risk and story quality.', makes: 'Testability per AC, quality score and risk per story, guest-journey map.' },
  { key: 'design', n: 3, name: 'Test design agent', does: 'Designs the end-to-end guest journey plus positive variant and manual test cases. No negative or boundary cases.', makes: 'Test cases with steps, test data and expected results; traceability matrix for the review; Zephyr Scale Excel export.' },
  { key: 'review', n: 4, name: 'Human review', gate: true, does: 'The reviewer approves the test cases, excludes some, or rejects the requirement set.', makes: 'An approved set of automation test cases.' },
  { key: 'scripts', n: 5, name: 'Automation agent', does: 'Explores the live app black-box through Playwright MCP and resolves each step to an element.', makes: 'Page objects and one Playwright spec per automation test case.' },
  { key: 'execution', n: 6, name: 'Execution agent', does: 'Runs the generated Playwright specs headless against the selected release.', makes: 'Real results with screenshots and traces for failures.' },
  { key: 'execreview', n: 7, name: 'Execution review', gate: true, does: 'The reviewer checks the execution results, decides which failures are raised as Jira defects and records the manual test results.', makes: 'Approved defects to raise, failures not raised (with reason) and manual results: passed, failed or not run.' },
  { key: 'reporting', n: 8, name: 'Reporting agent', does: 'Raises Jira bugs for failures, builds traceability and applies the release criteria.', makes: 'QE lead report, Go / Conditional / No-go decision, Excel exports.' },
];
const STATE = { pending: 'Yet to start', running: 'Running', done: 'Done', approved: 'Approved', waiting: 'Your review', failed: 'Stopped' };

let state = { config: null, runs: [], run: null, files: null, file: null, timer: null, lastUpdate: null };

function parseHash() {
  const [p, q = ''] = location.hash.replace(/^#\/?/, '').split('?');
  return { parts: p.split('/').filter(Boolean), q: Object.fromEntries(new URLSearchParams(q)) };
}
const go = (path, q = {}) => { const s = new URLSearchParams(Object.entries(q).filter(([, v]) => v != null && v !== '')).toString(); location.hash = `#/${path}${s ? `?${s}` : ''}`; };
function activeNav(r) { $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.r === r)); }

async function loadConfig() {
  try { state.config = await api('/api/config'); } catch { state.config = {}; }
  const c = state.config;
  $('#conn').innerHTML = [
    `<a href="${JIRA}" target="_blank" rel="noopener"><i class="dot ${c.jira ? 'ok' : 'bad'}"></i>Mock Jira</a>`,
    `<a href="${APP}" target="_blank" rel="noopener"><i class="dot ${c.app ? 'ok' : 'bad'}"></i>StayEase ${c.app ? esc(c.app.release) : 'offline'}</a>`,
    '<span class="mcp"><i class="dot ok"></i>Playwright MCP</span>',
  ].join('');
}
const loadRuns = async () => { state.runs = await api('/api/runs'); return state.runs; };
const completed = () => state.runs.filter((r) => r.decision);

// ---------- shared pieces ----------
function hero(eyebrow, title, text, actions = '', small = true) {
  return `<section class="hero ${small ? 'small-hero' : ''}"><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1>${text ? `<p>${text}</p>` : ''}${actions}</section>`;
}
const cycleProgress = (run) => Math.round(run.stages.reduce((n, s) => n + (['done', 'approved'].includes(s.status) ? 100 : s.status === 'running' ? s.progress || 0 : 0), 0) / run.stages.length);
function agentCards(run) {
  return `<div class="agent-grid">${AGENTS.map((a) => {
    const st = run ? run.stages.find((s) => s.key === a.key) : null;
    const status = st ? st.status : 'pending';
    const tab = { intake: 'requirements', analysis: 'analysis', design: 'testcases', review: 'review', scripts: 'scripts', execution: 'execution', execreview: 'execreview', reporting: 'summary' }[a.key];
    const tag = run ? 'a' : 'div';
    const href = run ? ` href="#/cycle/${run.id}?tab=${tab}"` : '';
    return `<${tag} class="agent-card ${a.gate ? 'gate' : ''} ${status}"${href}><div class="agent-head"><b><span class="step-num ${a.gate ? 'gold' : ''}">${a.n}</span>${esc(a.name)}</b><span class="state ${status}">${status === 'running' ? '<span class="spin"></span> ' : ''}${STATE[status] || status}</span></div>
      ${status === 'running' ? `<div class="prog-row"><div class="prog" role="progressbar" aria-label="${esc(a.name)} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${st.progress || 0}"><i style="width:${st.progress || 0}%"></i></div><b class="prog-pct">${st.progress || 0}%</b></div>` : ''}
      <p>${esc(status === 'running' && st.progressNote ? st.progressNote : st && (st.error || st.summary) ? (st.error || st.summary) : a.does)}</p>
      <div class="sub">${st && st.startedAt && st.finishedAt ? dur(st.startedAt, st.finishedAt) : run ? '' : esc(a.makes)}${!run && a.n > 4 ? ' Runs after your approval.' : ''}</div></${tag}>`;
  }).join('')}</div><div class="legend"><span class="l-agent">AI agent</span><span class="l-gate">Human approval before automation</span></div>`;
}
const metricCard = (k, v, d, cls = '') => `<div class="metric ${cls}"><div class="k">${esc(k)}</div><b>${esc(v)}</b><div class="d">${d}</div></div>`;
async function cyclePicker(path, q, onlyDone = true) {
  const list = typeof onlyDone === 'function' ? state.runs.filter(onlyDone) : onlyDone ? completed() : state.runs;
  if (!list.length) return { html: `<p class="muted">No cycle has completed yet. <a href="#/run">Run a cycle</a>.</p>`, id: null };
  const id = q.cycle && list.some((r) => r.id === q.cycle) ? q.cycle : list[0].id;
  return { id, html: `<div class="cycle-picker"><div class="field"><label class="f" for="cycle">Cycle</label><select id="cycle">${list.map((r) => `<option value="${r.id}" ${r.id === id ? 'selected' : ''}>${r.id} · ${esc(r.config.initiative)} · StayEase ${esc(r.release || r.config.release || '')} · ${esc(r.decision || r.status)}</option>`).join('')}</select></div></div>` };
}
function bindPicker(path, q) { const s = $('#cycle'); if (s) s.onchange = () => go(path, { ...q, cycle: s.value }); }

// ---------- Reset demo ----------
function resetDemo() {
  const busy = state.runs.filter((r) => ['running', 'queued'].includes(r.status));
  const d = document.createElement('dialog'); d.className = 'modal';
  d.innerHTML = `<form method="dialog"><div class="eyebrow">Reset demo</div><h2 style="margin-top:4px">Start the demo again from a clean state?</h2>
    <ul class="small"><li>Deletes all ${state.runs.length} cycle(s) with their scripts, results and reports</li><li>Restores the original EQE stories in mock Jira and removes raised bugs</li><li>Empties the StayEase reservations (release 1.0 and 1.1)</li></ul>
    ${busy.length ? `<div class="banner bad">${busy.map((r) => r.id).join(', ')} is still running. Wait for it or cancel it first.</div>` : ''}
    <label class="check"><input type="checkbox" id="rs-rerun"><div><b>Run the two demo cycles again</b><span>Release 1.0 (expected No-go) and release 1.1 (expected Go), review skipped, about a minute.</span></div></label>
    <p style="display:flex;gap:8px;margin:16px 0 0"><button class="btn danger" id="rs-go" value="go" ${busy.length ? 'disabled' : ''}>Reset demo</button><button class="btn secondary" value="cancel">Cancel</button></p>
    <div id="rs-err" class="small" style="color:var(--bad);margin-top:8px"></div></form>`;
  document.body.appendChild(d); d.showModal();
  d.addEventListener('close', () => d.remove());
  $('#rs-go', d).onclick = async (e) => {
    e.preventDefault(); e.target.disabled = true;
    try {
      const r = await api('/api/demo/reset', { method: 'POST', body: JSON.stringify({ rerun: $('#rs-rerun', d).checked, reviewer: localStorage.getItem('eqe-reviewer') || 'EQE lead' }) });
      d.close(); state.files = null; state.file = null;
      if (r.started) go(`cycle/${r.started[0]}`); else { go('cycles'); route(); }
    } catch (err) { $('#rs-err', d).textContent = err.message; e.target.disabled = false; }
  };
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-reset-demo]'); if (b) { e.preventDefault(); resetDemo(); } });

// ---------- Home ----------
function viewHome() {
  activeNav('');
  const runs = state.runs; const last = completed()[0];
  $('#view').innerHTML = `
    <section class="hero"><div class="eyebrow">EQE · Agentic quality engineering</div><h1>From Jira requirements to a release decision</h1>
      <p>Seven agents read the StayEase requirements from Jira, analyse them, design end-to-end test cases, generate Playwright scripts by exploring the live app through MCP, run them and report. A person approves before anything is automated.</p>
      <a class="btn" href="#/run">▶ Start a cycle</a> <a class="btn secondary" href="#/cycles">View cycles</a> ${last ? `<a class="btn secondary" href="#/reporting?cycle=${last.id}">Latest report</a>` : ''} <button class="btn secondary" data-reset-demo>Reset demo</button></section>
    <div class="stats">
      <div class="stat"><b>${runs.length}</b><div class="stat-t">Cycles run</div><div class="stat-d">${completed().length} completed with a release decision</div></div>
      <div class="stat"><b>7</b><div class="stat-t">Agents</div><div class="stat-d">Requirements to reporting, running in the background</div></div>
      <div class="stat"><b>${last ? `${last.metrics?.acCoverage ?? 100}%` : '–'}</b><div class="stat-t">Traceability</div><div class="stat-d">Acceptance criteria to test, script, result and defect</div></div>
      <div class="stat"><b>Human</b><div class="stat-t">Governance</div><div class="stat-d">Reviewer approval before any automation</div></div>
    </div>
    <h2>How the platform works</h2>
    <ol class="lifecycle">${AGENTS.map((a) => `<li><span class="lc-k">${a.gate ? 'Govern' : a.n <= 3 ? 'Design' : a.n <= 6 ? 'Validate' : 'Release'}</span><b>${esc(a.name)}</b><span class="d">${esc(a.does)}</span></li>`).join('')}</ol>
    <h2>What goes in</h2>
    <div class="grid3">
      <div class="panel"><div class="panel-title">Jira initiative</div><p class="small">${(state.config?.initiatives || []).map((i) => `${jiraLink(i.key)} ${esc(i.summary)}`).join('<br>') || 'Mock Jira offline'}</p></div>
      <div class="panel"><div class="panel-title">Jira epics and stories</div><p class="small">Search hotels · Find hotel and reservation · Create reservation. Acceptance criteria live in each story. <a href="${JIRA}" target="_blank" rel="noopener">Open mock Jira</a></p></div>
      <div class="panel"><div class="panel-title">Application under test</div><p class="small">StayEase hotel booking, tested black-box through the browser only. Release 1.0 (<a href="${APP}" target="_blank" rel="noopener">open</a>) and release 1.1.</p></div>
    </div>
    <h2>About the mock application: StayEase</h2>
    <div class="panel about-aut">
      <p style="margin-top:0">StayEase is a <b>mock hotel booking website</b> built only for this EQE demo. It stands in for a real Marriott-style guest site so the agents have something real to test in a browser. The hotels, rooms, prices and bookings are synthetic, no payment is taken, and the data resets whenever the app restarts.</p>
      <div class="grid3">
        <div><div class="panel-title">Guest journeys it covers</div><ul class="small"><li>Search hotels by destination, dates and guests</li><li>View a hotel, its rooms and prices</li><li>Create a reservation with guest details</li><li>Find a reservation by confirmation number and last name</li></ul></div>
        <div><div class="panel-title">Two releases</div><ul class="small"><li><b>1.0</b>, the current release (<a href="${APP}" target="_blank" rel="noopener">port 4100</a>): two seeded defects in Find reservation, one per initiative. The <b>last name</b> is matched case-sensitively (MGPP-1, EQE-8) and so is the <b>confirmation number</b> (MGPP-2, EQE-14). Each cycle should fail one test (expected: No-go).</li><li><b>1.1</b>, the candidate release (port 4101): the same app with both defects fixed (expected: Go).</li></ul></div>
        <div><div class="panel-title">How it is tested</div><ul class="small"><li>Black-box: agents see only what a browser shows, never the code.</li><li>Requirements come from the mock Jira initiative (<a href="${JIRA}" target="_blank" rel="noopener">port 4200</a>).</li><li>In AI mode the Devin session starts its own copy of StayEase; in production a stage URL replaces it.</li></ul></div>
      </div>
    </div>
    <h2>Recent cycles</h2>${cycleTiles(runs.slice(0, 4))}`;
}
function cycleTiles(list) {
  if (!list.length) return '<p class="muted">No cycles yet. <a href="#/run">Run a cycle</a>.</p>';
  return `<div class="tiles">${list.map((r) => {
    const done = r.stages.filter((s) => ['done', 'approved'].includes(s.status)).length;
    const m = r.metrics;
    return `<a class="tile" href="#/cycle/${r.id}"><div class="art ${r.decision || (r.status.startsWith('awaiting') ? 'waiting' : '')}"><span class="tag">${esc(r.id)} · Flow 1 baseline</span><span class="big">${esc(r.decision || (r.status.startsWith('awaiting') ? 'Review' : r.status))}</span><span class="pill ${esc(r.status)}">${esc(r.status)}</span></div>
      <div class="body"><b class="t">${esc(r.config.initiative)} · StayEase ${esc(r.release || r.config.release || '')}</b>${m ? `Automation test cases passed ${m.passed}/${m.executed} · ${m.defects} defect(s)` : `${done}/${r.stages.length} steps complete`}<div class="muted">${when(r.createdAt)}${r.reviewer ? ` · reviewer ${esc(r.reviewer)}` : ''}</div><div class="bar"><i style="width:${Math.round((done / r.stages.length) * 100)}%"></i></div></div></a>`;
  }).join('')}</div>`;
}

// ---------- Run ----------
function viewRun() {
  activeNav('run');
  const c = state.config || {};
  $('#view').innerHTML = `<div class="run-layout">
    <form class="panel" id="new-run">
      ${c.jiraError ? `<div class="banner bad">Mock Jira is not reachable: ${esc(c.jiraError)}</div>` : ''}
      <div class="step-block"><h3><span class="step-num">1</span>Requirements from Jira</h3><p class="hint">EQE takes the Jira initiative with its epics and stories, not the code.</p>
        <label class="f" for="initiative">Jira initiative</label><select id="initiative" required>${(c.initiatives || []).map((i) => `<option value="${esc(i.key)}">${esc(i.key)} · ${esc(i.summary)}</option>`).join('')}</select>
        <p class="hint small" style="margin-top:6px">Epics and stories are read from the initiative's children. Edit them in <a href="${JIRA}" target="_blank" rel="noopener">mock Jira</a> before running.</p>
        <label class="f" for="docs" style="margin-top:12px">Requirement documents (optional)</label>
        <label class="dropzone" for="docs" id="dropzone"><input type="file" id="docs" multiple accept=".pdf,.docx,.doc,.txt,.md,.csv,.xlsx,.xls,.pptx,.json,.html,.png,.jpg">
          <span class="dz-icon" aria-hidden="true">⬆</span><span><b>Drop files here or <u>choose files</u></b><span class="dz-sub">PDF, Word, Excel, PowerPoint, text, images · multiple files · 25 MB total</span></span></label>
        <div id="docs-list" class="doc-chips"></div>
        <p class="hint small" style="margin-top:4px">Upload one or more files (BRD, specs, mock-ups, test data). The Devin (AI) engine uses them, together with the Jira stories, in the requirements, analysis and test design agents. The rule-based engine ignores them. Max 25 MB in total.</p></div>
      <div class="step-block"><h3><span class="step-num">2</span>Application under test</h3><p class="hint">Black-box: the automation agent only sees what a browser sees, through Playwright MCP.</p>
        ${RELEASES.map((r, i) => `<label class="mode-option"><input type="radio" name="release" value="${r.id}" ${i ? '' : 'checked'}><div><b>${esc(r.label)}</b><span>${esc(r.note)} <code>${esc(r.url)}</code></span></div></label>`).join('')}</div>
      <div class="step-block"><h3><span class="step-num">3</span>Agent engine</h3><p class="hint">Who runs the six agents for this cycle.</p>
        <label class="mode-option"><input type="radio" name="engine" value="devin" ${c.devin?.configured ? 'checked' : 'disabled'}><div><b>Devin (AI)</b><span>One Devin session runs all six agents: it starts the app in its own machine, reads the requirements, designs, automates, executes and reports. ${c.devin?.configured ? `API <code>${esc(c.devin.apiUrl)}</code>` : 'Not configured: set DEVIN_API_KEY and DEVIN_ORG_ID in <code>.env</code> and restart.'}</span></div></label>
        <label class="mode-option"><input type="radio" name="engine" value="rules" ${c.devin?.configured ? '' : 'checked'}><div><b>Rule-based (offline)</b><span>The built-in pattern catalogue on this machine. No AI; repeatable demo.</span></div></label>
        <label class="f" for="targetUrl" style="margin-top:8px">Stage URL for the Devin session (optional)</label><input type="text" id="targetUrl" placeholder="Empty: Devin starts the selected StayEase release itself">
        <p class="hint small">For a real application, give a stage URL the Devin session can reach.</p></div>
      <div class="step-block"><h3><span class="step-num gold">4</span>Governance</h3>
        <label class="f" for="reviewer">Reviewer name (required)</label><input type="text" id="reviewer" placeholder="e.g. EQE automation lead" required>
        <p class="review-note" role="note" style="margin:10px 0 4px"><b><u>NOTE: Human review is mandatory after Test Design Agent</u></b></p>
        <label class="check"><input type="checkbox" id="slowMo"><div><b>Slow-motion execution</b><span>Runs the browsers slower so you can follow them in the live view.</span></div></label>
        </div>
      <p style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0"><button class="btn gold" type="submit">▶ Start cycle</button><button class="btn secondary" type="button" data-reset-demo>Reset demo</button></p><div id="err" class="small" style="color:var(--bad);margin-top:8px"></div>
    </form>
    <div class="panel"><div class="panel-title">Agents, and what each one produces for EQE</div>${agentCards(null)}
      <div class="panel-title" style="margin-top:22px">Release criteria applied by the reporting agent</div>
      <p class="small">${c.criteria ? `Automation pass rate ≥ <b>${c.criteria.minAutomationPassRate}%</b> · AC coverage ≥ <b>${c.criteria.minAcceptanceCriteriaCoverage}%</b> · No-go on <b>${esc(c.criteria.noGoSeverities.join(', '))}</b> defects · Conditional on <b>${esc(c.criteria.conditionalSeverities.join(', '))}</b> defects · sign-off: ${esc(c.criteria.signOffOwner)}` : ''}</p>
      <p class="small muted">Edit <code>dashboard/config/release-criteria.json</code> to change the decision without a code change.</p></div>
  </div>`;
  state.uploadDocs = [];
  const showDocs = () => {
    $('#docs-list').innerHTML = state.uploadDocs.map((d, i) => `<span class="doc-chip"><span class="doc-ext">${esc((d.name.split('.').pop() || 'file').slice(0, 4).toUpperCase())}</span>${esc(d.name)} <span class="muted">${d.size < 1024 ? `${d.size} B` : `${Math.round(d.size / 1024)} KB`}</span><button type="button" class="doc-x" data-i="${i}" aria-label="Remove ${esc(d.name)}">×</button></span>`).join('');
    $$('.doc-x').forEach((x) => { x.onclick = () => { state.uploadDocs.splice(Number(x.dataset.i), 1); showDocs(); }; });
  };
  const dz = $('#dropzone');
  ['dragenter', 'dragover'].forEach((e) => dz.addEventListener(e, (ev) => { ev.preventDefault(); dz.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((e) => dz.addEventListener(e, () => dz.classList.remove('over')));
  dz.addEventListener('drop', (ev) => { ev.preventDefault(); addFiles([...ev.dataTransfer.files]); });
  $('#docs').onchange = (ev) => { addFiles([...ev.target.files]); ev.target.value = ''; };
  const addFiles = async (files) => {
    const read = (f) => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok({ name: f.name, size: f.size, type: f.type, data: String(r.result).split(',')[1] || '' }); r.onerror = bad; r.readAsDataURL(f); });
    const added = await Promise.all(files.map(read));
    const next = [...state.uploadDocs.filter((d) => !added.some((a) => a.name === d.name)), ...added];
    if (next.reduce((n, d) => n + d.size, 0) > 25 * 1024 * 1024) { $('#err').textContent = 'Documents exceed 25 MB in total.'; return; }
    $('#err').textContent = ''; state.uploadDocs = next; showDocs();
  };
  const saved = localStorage.getItem('eqe-reviewer'); if (saved) $('#reviewer').value = saved;
  $('#new-run').onsubmit = async (e) => {
    e.preventDefault();
    const rel = RELEASES.find((r) => r.id === $('input[name=release]:checked').value);
    const reviewer = $('#reviewer').value.trim();
    if (!reviewer) { $('#err').textContent = 'Enter the reviewer name.'; return; }
    localStorage.setItem('eqe-reviewer', reviewer);
    try {
      const r = await api('/api/runs', { method: 'POST', body: JSON.stringify({ initiative: $('#initiative').value, appUrl: rel.url, engine: ($('input[name=engine]:checked') || {}).value || 'rules', documents: state.uploadDocs || [], targetUrl: $('#targetUrl').value.trim(), release: rel.id, reviewer, slowMo: $('#slowMo').checked }) });
      go(`cycle/${r.id}`);
    } catch (err) { $('#err').textContent = err.message; }
  };
}

// ---------- Cycles ----------
function viewCycles() {
  activeNav('cycles');
  $('#view').innerHTML = hero('Cycles', 'Every run, by flow', 'Open a cycle to browse its phases: intake and analysis, test design and your review, then script generation, execution and the report.', '<a class="btn" href="#/run">▶ Run a new cycle</a> <button class="btn secondary" data-reset-demo>Reset demo</button>') + cycleTiles(state.runs);
}

// ---------- Cycle ----------
const TABS = [['summary', 'Run summary'], ['requirements', 'Requirements'], ['analysis', 'Analysis'], ['testcases', 'Test cases'], ['review', 'Review'], ['scripts', 'Automation scripts'], ['execution', 'Execution'], ['execreview', 'Execution review'], ['defects', 'Defects'], ['activity', 'Activity']];
const pending = (name) => `<div class="panel empty">${esc(name)} has not produced output yet.</div>`;

function tabSummary(run) {
  const r = run.report; const t = run.analysis?.totals; const e = run.execution; const s = run.scripts;
  return `${run.status === 'awaiting-approval' ? `<div class="banner action"><b>Waiting for your review.</b> Check the designed test cases, untick any you do not want automated, then approve. <a class="btn sm" href="#/cycle/${run.id}?tab=review" style="margin-left:8px">Review</a></div>` : ''}
    ${run.status === 'awaiting-execution-review' ? `<div class="banner action"><b>Waiting for your execution review.</b> Decide which failures are raised as Jira defects and record the manual test results, then approve to generate the report. <a class="btn sm" href="#/cycle/${run.id}?tab=execreview" style="margin-left:8px">Execution review</a></div>` : ''}
    ${run.status === 'rejected' ? `<div class="banner bad"><b>Requirement set rejected</b> by ${esc(run.review.rejectedBy)}${run.review.reason ? `: ${esc(run.review.reason)}` : ''}. Fix the stories in Jira and start a new cycle.</div>` : ''}
    ${r ? `<div class="outcome"><span class="big ${r.decision}">${esc(r.decision)}</span><div><b>Release decision · StayEase ${esc(r.release || '')}</b><ul>${r.reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div><a class="btn" style="margin-left:auto" href="#/reporting?cycle=${run.id}">Open report</a></div>` : ''}
    ${r?.ai ? `<div class="panel ai-note"><div class="panel-title">Executive summary · written by Devin</div><p>${esc(r.ai.executiveSummary)}</p>${r.ai.recommendation ? `<p class="small">Devin recommends <b>${esc(r.ai.recommendation.decision)}</b>${(r.ai.recommendation.reasons || []).length ? `: ${r.ai.recommendation.reasons.map(esc).join('; ')}` : ''}. The release decision above applies <code>release-criteria.json</code>.</p>` : ''}${(r.ai.risks || []).length ? `<b class="small">Risks</b><ul class="small">${r.ai.risks.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>` : ''}
    <div class="panel"><div class="panel-title">Run summary</div><table><tbody>
      <tr><td style="width:260px">Requirements read from Jira</td><td>${run.requirements ? `${run.requirements.epics.length} epics · ${run.requirements.stories.length} stories · ${t ? t.acs : '…'} acceptance criteria` : '…'}</td></tr>
      <tr><td>Acceptance criteria analysed</td><td>${t ? `${t.automatable} automatable · ${t.ambiguous} ambiguous · ${t.notObservable} not UI-observable · avg story quality ${t.avgQuality}/100` : '…'}</td></tr>
      <tr><td>Test cases designed</td><td>${run.design ? `${run.design.total} (${run.design.automation} automatable, ${run.design.manual} manual) · AC coverage ${run.design.acCoverage}%` : '…'}</td></tr>
      <tr><td>Human review</td><td>${run.review?.approvedBy ? `Approved by <b>${esc(run.review.approvedBy)}</b>${run.review.excluded?.length ? ` · excluded ${run.review.excluded.join(', ')}` : ''}${run.review.note ? ` · "${esc(run.review.note)}"` : ''}` : run.review?.rejectedBy ? `Rejected by ${esc(run.review.rejectedBy)}` : run.status === 'awaiting-approval' ? 'Waiting' : '…'}</td></tr>
      <tr><td>Automation scripts</td><td>${s ? `${s.generated} generated${s.needsAttention ? `, ${s.needsAttention} need attention` : ''} · ${s.pageObjects.length} page objects · ${s.locators} locators ${s.mcpCalls == null ? '' : ` · ${s.mcpCalls} Playwright MCP calls`}` : '…'}</td></tr>
      <tr><td>Automation test cases passed</td><td>${e ? `${e.passed}/${e.passed + e.failed}${e.skipped ? ` · ${e.skipped} skipped` : ''} in ${(e.durationMs / 1000).toFixed(1)}s` : '…'}</td></tr>
      <tr><td>Execution review</td><td>${run.execReview?.approvedBy ? `Approved by <b>${esc(run.execReview.approvedBy)}</b>${run.execReview.note ? ` · "${esc(run.execReview.note)}"` : ''}${r?.metrics.manualPassed != null ? ` · manual ${r.metrics.manualPassed} passed, ${r.metrics.manualFailed} failed, ${r.metrics.manualNotRun} not run` : ''}${r?.notRaised?.length ? ` · not raised: ${r.notRaised.map((d) => esc(d.tcId)).join(', ')}` : ''}` : run.status === 'awaiting-execution-review' ? 'Waiting' : '…'}</td></tr>
      <tr><td>Defects</td><td>${r ? (r.defects.length ? r.defects.map((d) => `${d.jiraKey ? jiraLink(d.jiraKey) : esc(d.id)} ${pill(d.severity)} ${esc(d.storyKeys.join(', '))}`).join('<br>') : 'None') : '…'}</td></tr>
    </tbody></table></div>
    <div class="panel"><div class="panel-title">Inputs considered</div><table><thead><tr><th>Input</th><th>Source</th><th>Detail</th></tr></thead><tbody>
      <tr><td>Jira initiative</td><td>${esc(run.requirements?.source || state.config?.jiraUrl || '')}</td><td>${jiraLink(run.config.initiative)} ${esc(run.requirements?.initiative.summary || '')}</td></tr>
      <tr><td>Jira epics and stories</td><td>children of ${esc(run.config.initiative)}</td><td>${run.requirements ? run.requirements.epics.map((e2) => `${jiraLink(e2.key)} (${run.requirements.stories.filter((x) => x.epicKey === e2.key).map((x) => x.key).join(', ')})`).join(' · ') : '…'}</td></tr>
      <tr><td>Application under test</td><td>${esc(run.config.appUrl)}</td><td>StayEase ${esc(run.config.release || '')} · black-box through Playwright MCP</td></tr>
    </tbody></table><p class="small muted" style="margin-top:8px">No gap check: EQE takes only the Jira initiative, epics and stories, not the code.</p></div>`;
}
function tabRequirements(run) {
  const q = run.requirements; if (!q) return pending('Requirements agent');
  return `<div class="panel"><div class="panel-title">${jiraLink(q.initiative.key)} ${esc(q.initiative.summary)} <span class="muted small" style="text-transform:none;letter-spacing:0">· read ${when(q.readAt)}</span></div>
    ${q.epics.map((e) => `<h3>${pill('run', 'Epic')} ${jiraLink(e.key)} ${esc(e.summary)} <span class="muted small">· ${esc(e.priority)}</span></h3>
      <table><thead><tr><th style="width:90px">Story</th><th>Summary and acceptance criteria</th><th style="width:90px">Priority</th></tr></thead><tbody>
      ${q.stories.filter((s) => s.epicKey === e.key).map((s) => `<tr><td>${jiraLink(s.key)}</td><td><b>${esc(s.summary)}</b><div class="muted small">${esc(s.text)}</div><ol class="steps small">${s.ac.map((a) => `<li><span class="mono muted">${esc(a.id)}</span> ${esc(a.text)}</li>`).join('')}</ol></td><td>${esc(s.priority)}</td></tr>`).join('')}
      </tbody></table>`).join('')}</div>${(run.config.documents || []).length ? `<div class="panel"><div class="panel-title">Requirement documents uploaded with this cycle</div><ul>${run.config.documents.map((d) => `<li><a href="/artifacts/${run.id}/docs/${encodeURIComponent(d.file)}" target="_blank" rel="noopener">${esc(d.name)}</a> <span class="muted small">(${Math.round(d.size / 1024)} KB)</span></li>`).join('')}</ul><p class="small muted">${run.config.engine === 'devin' ? 'Sent to the Devin session with the Jira stories.' : 'Not used: the rule-based engine reads Jira only.'}</p></div>` : ''}${(q.gaps || []).length ? `<div class="panel"><div class="panel-title">Gaps found by Devin during intake</div><ul>${q.gaps.map((g) => `<li>${g.storyKey ? jiraLink(g.storyKey) + ' ' : ''}${esc(g.text)}</li>`).join('')}</ul></div>` : ''}${aiNote('Intake summary', q.aiSummary)}`;
}
function tabAnalysis(run) {
  const a = run.analysis; if (!a) return pending('Analysis agent');
  const t = a.totals;
  return `${aiNote('Analysis summary', a.aiSummary)}<div class="grid5" style="margin-bottom:16px">${metricCard('Acceptance criteria', t.acs, `${t.stories} stories`)}${metricCard('Automatable', t.automatable, 'UI-observable and measurable', 'ok')}${metricCard('Ambiguous', t.ambiguous, 'Need a measurable threshold')}${metricCard('Not UI-observable', t.notObservable, 'Manual test cases')}${metricCard('Avg story quality', `${t.avgQuality}/100`, `${t.highRisk} high-risk stor${t.highRisk === 1 ? 'y' : 'ies'}`)}</div>
    <div class="panel"><div class="panel-title">Guest journey coverage</div><ol class="lifecycle" style="grid-template-columns:repeat(${a.journey.length},1fr)">${a.journey.map((j) => `<li><span class="lc-k">Journey stage</span><b>${esc(j.label)}</b><span class="d">${j.stories.map(jiraLink).join(', ') || 'no stories'}</span></li>`).join('')}</ol></div>
    <div class="panel"><div class="panel-title">Stories</div><table><thead><tr><th>Story</th><th>Stage</th><th>Risk</th><th>Quality</th><th>Findings</th></tr></thead><tbody>
    ${a.stories.map((s) => `<tr><td>${jiraLink(s.key)} ${esc(s.summary)}</td><td>${esc(s.stageLabel)}</td><td>${pill(s.risk === 'High' ? 'High' : 'x', s.risk)} ${s.riskReason ? `<div class="small muted">${esc(s.riskReason)}</div>` : `<span class="muted small">${s.riskScore}</span>`}</td><td><b>${s.qualityScore}</b>/100<div class="bar"><i style="width:${s.qualityScore}%"></i></div></td><td class="small">${s.findings.length ? s.findings.map((f) => `<div>${pill(f.level === 'high' ? 'bad' : f.level === 'medium' ? 'warn' : 'x', f.level)} ${esc(f.text)}</div>`).join('') : '<span class="muted">None</span>'}${(s.questions || []).length ? `<div style="margin-top:6px"><b>Questions for the product owner</b><ul style="margin:2px 0 0 16px;padding:0">${s.questions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="panel"><div class="panel-title">Acceptance criteria</div><table><thead><tr><th>AC</th><th>Text</th><th>Technique</th><th>Testability</th></tr></thead><tbody>
    ${a.stories.flatMap((s) => s.acs).map((c) => `<tr><td class="mono nowrap">${esc(c.id)}</td><td>${esc(c.text)}${c.issues.length ? `<div class="small" style="color:var(--warn)">${c.issues.map(esc).join(' · ')}</div>` : ''}</td><td class="small">${esc(c.label)}${c.reason && c.technique === 'ai' ? `<div class="muted">${esc(c.reason)}</div>` : ''}</td><td>${pill(c.testability)}</td></tr>`).join('')}
    </tbody></table></div>`;
}
const stepsList = (tc) => `<ol class="steps small">${tc.steps.map((s) => `<li>${esc(s.action)}${s.expected ? ` <span class="muted">→ ${esc(s.expected)}</span>` : ''}</li>`).join('')}</ol>`;
function testCaseRows(run, gate) {
  const ex = run.review?.excluded || [];
  return run.testCases.map((t) => `<tr>${gate ? `<td>${t.automation === 'Automation' ? `<input type="checkbox" class="keep" value="${t.id}" checked aria-label="Automate ${t.id}">` : ''}</td>` : ''}<td class="mono">${t.id}</td>
    <td><details><summary><b>${esc(t.title)}</b> <span class="muted small">· ${t.steps.length} steps</span></summary>${t.preconditions ? `<div class="small muted">${esc(t.preconditions)}</div>` : ''}${t.testDataFrom?.length ? `<div class="small muted">Test data from ${t.testDataFrom.map(jiraLink).join(', ')}</div>` : ''}${stepsList(t)}</details></td>
    <td>${pill(ex.includes(t.id) ? 'Excluded' : t.automation, ex.includes(t.id) ? 'Excluded' : t.automation === 'Manual' ? 'Manual' : 'Automatable')}<div class="small muted">${esc(t.type)}</div></td><td>${levelPill(run, t)}</td><td>${esc(t.priority)}</td><td class="small">${t.storyKeys.map(jiraLink).join(', ')}<div class="mono muted">${t.acIds.join(', ')}</div></td></tr>`).join('');
}
function testDataPanel(run) {
  const t = run.design?.testDataTable; if (!t) return '';
  return `<details class="panel collapsible"><summary class="panel-title">Test data · read from the "Test data" section of the Jira stories <span class="muted small" style="text-transform:none;letter-spacing:0">(${t.length} value${t.length === 1 ? '' : 's'} · click to expand)</span></summary>
    <table class="grid"><thead><tr><th>Name</th><th>Value</th><th>Source</th></tr></thead><tbody>${t.map((r) => `<tr><td>${esc(r.name)}</td><td class="mono">${esc(r.value)}</td><td>${r.story ? jiraLink(r.story) : '<span class="pill warn">Default · not in Jira</span>'}</td></tr>`).join('')}</tbody></table>
    <p class="small muted">To change a value, edit the story's Test data in Jira and start a new cycle.</p></details>`;
}
function tabTestcases(run) {
  if (!run.testCases) return pending('Test design agent');
  const d = run.design;
  return `${aiNote('Test design summary', d.aiSummary)}<div class="grid5" style="margin-bottom:16px">${metricCard('Test cases', d.total, 'designed from the acceptance criteria')}${metricCard('Automatable test cases', d.automation, 'go to the automation agent')}${metricCard('Manual test cases', d.manual, 'not UI-observable or ambiguous')}${metricCard('AC coverage', `${d.acCoverage}%`, `${d.acCovered}/${d.acTotal} acceptance criteria`, 'ok')}${metricCard('Test data', d.testDataTable ? `${d.testDataTable.filter((r) => r.story).length}/${d.testDataTable.length}` : esc(d.testData.destination), d.testDataTable ? 'values taken from Jira stories' : `${d.testData.nights} nights · ${d.testData.guests} guests`, d.testDataTable && d.testDataTable.some((r) => !r.story) ? 'warn' : 'ok')}</div>
    ${testDataPanel(run)}
    <div class="panel"><div class="panel-title" style="display:flex;justify-content:space-between;align-items:center">Test cases<a class="btn secondary sm" href="/api/runs/${run.id}/export/testcases.xlsx">Zephyr Scale Excel</a></div>
    <table><thead><tr><th style="width:80px">ID</th><th>Test case</th><th>Type</th><th>Level</th><th>Priority</th><th>Requirements</th></tr></thead><tbody>${testCaseRows(run, false)}</tbody></table></div>`;
}
function designMatrix(run) {
  const cols = run.analysis.stories.map((x) => x.key);
  const na = '<td class="cell na" title="Not applicable: this test case does not cover this story" aria-label="Not applicable">–</td>';
  const cell = (t, k) => { const ids = t.acIds.filter((id) => id.startsWith(`${k}-`)); return t.storyKeys.includes(k) ? `<td class="cell cov" title="${esc(ids.join(', '))}">${ids.map((id) => esc(id.slice(k.length + 1))).join(', ') || '✓'}</td>` : na; };
  const d = run.design || {};
  return `<div class="panel"><div class="panel-title">Traceability matrix · generated by the Test design agent, before approval</div>
    <p class="small muted" style="margin-top:0">Rows are test cases, columns are Jira stories. A cell lists the acceptance criteria of that story the test case covers; a greyed-out cell (–) means the story is not applicable to that test case. AC coverage ${d.acCoverage ?? '–'}% (${d.acCovered ?? 0}/${d.acTotal ?? 0})${d.uncovered?.length ? ` · not covered: ${d.uncovered.map(esc).join(', ')}` : ''}. Results appear in Traceability after execution.</p>
    <div class="table-scroll"><table class="matrix"><thead><tr><th>Test case</th><th>Type</th><th>Level</th>${cols.map((k) => `<th class="story">${jiraLink(k)}</th>`).join('')}<th>Acceptance criteria</th></tr></thead><tbody>${run.testCases.map((t) => `<tr><td><span class="mono">${t.id}</span> ${esc(t.title)}</td><td>${pill(t.automation)}</td><td>${levelPill(run, t)}</td>${cols.map((k) => cell(t, k)).join('')}<td class="mono small">${t.acIds.join(', ')}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function tabReview(run) {
  if (!run.testCases) return pending('Test design agent');
  const gate = run.status === 'awaiting-approval';
  const head = gate ? `<div class="banner action"><b>Your review, ${esc(run.config.reviewer || 'reviewer')}.</b> Untick any automation test case you do not want automated, then approve. Manual test cases stay for manual execution. If the requirements themselves are wrong, reject the requirement set.</div>`
    : run.review?.approvedBy ? `<div class="banner ok">Approved by <b>${esc(run.review.approvedBy)}</b> at ${when(run.review.approvedAt)}${run.review.excluded?.length ? ` · excluded ${run.review.excluded.join(', ')}` : ''}${run.review.note ? ` · "${esc(run.review.note)}"` : ''}</div>`
      : run.review?.rejectedBy ? `<div class="banner bad">Requirement set rejected by <b>${esc(run.review.rejectedBy)}</b>${run.review.reason ? `: ${esc(run.review.reason)}` : ''}</div>` : '<div class="banner">The review opens when the test design agent finishes.</div>';
  const amb = run.analysis?.stories.flatMap((s) => s.findings).filter((f) => f.level !== 'low') || [];
  return `${head}${amb.length ? `<div class="panel"><div class="panel-title">Advisory: what the analysis agent flagged</div><ul class="small">${amb.map((f) => `<li>${esc(f.text)}</li>`).join('')}</ul><p class="small muted">Advisory only. The reviewer decides.</p></div>` : ''}
    <div class="panel"><table><thead><tr>${gate ? '<th style="width:50px">Auto</th>' : ''}<th style="width:80px">ID</th><th>Test case</th><th>Type</th><th>Level</th><th>Priority</th><th>Requirements</th></tr></thead><tbody>${testCaseRows(run, gate)}</tbody></table>
    ${gate ? addCaseForm(run) : ''}
    ${gate ? `<label class="f" for="note">Review note <span class="req" aria-hidden="true">*</span></label><input type="text" id="note" required aria-required="true" placeholder="e.g. Approved for the release 1.0 regression"><p class="hint small" id="note-error" role="alert" style="color:#b3261e;display:none">Enter a review note before you approve or reject.</p>
      <p style="margin-top:12px;display:flex;gap:8px"><button class="btn gold" id="approve">Approve and generate scripts</button><button class="btn danger" id="reject">Reject requirement set</button></p>` : ''}</div>`;
}
function addCaseForm(run) {
  const opts = run.analysis.stories.map((s) => `<optgroup label="${esc(`${s.key} · ${s.summary}`)}">${s.acs.map((a) => `<option value="${esc(a.id)}">${esc(a.id)} · ${esc(a.text.length > 90 ? `${a.text.slice(0, 90)}…` : a.text)}</option>`).join('')}</optgroup>`).join('');
  return `<details class="addcase" id="addcase"><summary><b>+ Add test case</b> <span class="muted small">· created by you, level "User Defined", run manually</span></summary>
    <div class="addcase-grid"><div><label class="f" for="ac-title">Title *</label><input type="text" id="ac-title" placeholder="e.g. Guest cancels a reservation booked for tonight"></div>
    <div><label class="f" for="ac-type">Type</label><select id="ac-type">${['Functional', 'Variant', 'E2E journey', 'Exploratory'].map((x) => `<option>${x}</option>`).join('')}</select></div>
    <div><label class="f" for="ac-prio">Priority</label><select id="ac-prio"><option>P1</option><option selected>P2</option><option>P3</option></select></div></div>
    <label class="f" for="ac-acs">Acceptance criteria covered * <span class="muted small">(Ctrl/Cmd-click to pick several)</span></label><select id="ac-acs" multiple size="6">${opts}</select>
    <label class="f" for="ac-pre">Preconditions</label><input type="text" id="ac-pre" placeholder="e.g. A confirmed reservation exists">
    <label class="f" for="ac-steps">Steps * <span class="muted small">(one per line: action | expected result)</span></label><textarea id="ac-steps" rows="4" placeholder="Open Find reservation | The Find your reservation page is shown&#10;Find the reservation and select Cancel reservation | Status changes to Cancelled"></textarea>
    <p class="small" id="ac-error" role="alert" style="color:#b3261e;display:none"></p>
    <p style="margin-top:10px"><button class="btn secondary" id="ac-add">Add test case</button></p></details>`;
}
function tabScripts(run) {
  const s = run.scripts; if (!s) return pending('Automation agent');
  const mcp = s.mcpCalls != null || !s.exploration;
  return `<div class="grid5" style="margin-bottom:16px">${metricCard('Automation scripts', s.generated, 'one Playwright spec per test case', 'ok')}${metricCard('Need attention', s.needsAttention, 'steps MCP could not resolve')}${metricCard('Page objects', s.pageObjects.length, `${s.locators} locators`)}${s.mcpCalls == null && s.exploration ? metricCard('Exploration scripts', s.exploration.runs, esc(s.exploration.note)) : metricCard('Playwright MCP calls', s.mcpCalls ?? 0, s.engine === 'devin' ? 'black-box exploration · counted from the session\'s MCP log' : 'black-box exploration')}${metricCard('Not seen during exploration', s.dryRunMismatches, 'possible defects, confirmed by execution')}</div>
    <div class="panel"><div class="panel-title">${mcp ? 'MCP exploration per test case' : 'Exploration per test case'}</div><table><thead><tr><th>Test case</th><th>Status</th>${mcp ? '<th>MCP calls</th><th>Time</th>' : ''}<th>${mcp ? 'Steps resolved by MCP' : 'Steps resolved during exploration'}</th></tr></thead><tbody>
    ${s.cases.map((c) => `<tr><td class="mono">${c.tcId}<div><a href="#" data-file="${esc(c.file)}" class="small">${esc(c.file)}</a></div></td><td>${pill(c.status)}${c.dryRunMismatches ? `<div class="small" style="color:var(--warn)">${c.dryRunMismatches} not seen</div>` : ''}</td>${mcp ? `<td>${c.mcpCalls ?? 0}</td><td>${((c.ms || 0) / 1000).toFixed(1)}s</td>` : ''}
      <td><details><summary class="small">${c.steps.length} steps</summary><table class="small"><tbody>${c.steps.map((st) => `<tr><td>${st.n}</td><td>${esc(st.kind)}</td><td>${esc(st.term || '')}</td><td>${st.resolvedTo ? `${esc(st.resolvedTo)} <span class="muted">${esc(st.match || '')}</span>` : ''}<div class="mono muted">${esc(st.mcpCode || st.locator || '')}</div></td><td>${st.observed === 'unresolved' ? pill('failed', 'unresolved') : st.mismatch ? pill('warn', st.observed) : `<span class="muted">${esc(st.observed)}</span>`}${st.error ? `<div style="color:var(--bad)">${esc(st.error)}</div>` : ''}</td></tr>`).join('')}</tbody></table></details></td></tr>`).join('')}
    </tbody></table></div>
    <div class="panel"><div class="panel-title">Page objects discovered</div><table><thead><tr><th>Class</th><th>Property</th><th>Locator</th><th>Found for term</th></tr></thead><tbody>
    ${s.pageObjects.map((p) => p.locators.map((l, i) => `<tr><td>${i ? '' : `<b>${esc(p.class)}</b><div class="small muted">${esc(p.urls.join(', ') || 'header')}</div>`}</td><td class="mono">${esc(l.prop)}</td><td class="mono">${esc(l.locator)}</td><td class="small">${esc(l.term)}</td></tr>`).join('')).join('')}
    </tbody></table></div>
    <div class="panel" id="files-panel"><div class="panel-title">Generated code</div><div class="files"><nav id="file-list"><span class="muted small">Loading…</span></nav><div id="file-view"><div class="empty">Select a file</div></div></div></div>`;
}
function liveHtml() {
  const l = state.live || [];
  if (!l.length) return '<div class="empty">Waiting for the first browser to open…</div>';
  return `<div class="live-grid">${l.map((t) => `<figure class="live ${t.status}"><figcaption><span class="mono">${esc(t.id)}</span> ${t.status === 'running' ? '<span class="spin"></span>' : pill(t.status)}<span class="muted small" title="${esc(t.title || '')}">${esc((t.title || '').replace(/^TC-\d+\s*/, ''))}</span></figcaption>${t.frame ? `<img src="${t.frame}" alt="Live browser for ${esc(t.id)}">` : '<div class="empty">starting…</div>'}<div class="small muted mono">${esc((t.url || '').replace(/^https?:\/\/[^/]+/, ''))}</div></figure>`).join('')}</div>`;
}
const traceViewer = (run, r) => (r.trace && run.execution.htmlReport ? `${run.execution.htmlReport.replace(/index\.html$/, '')}trace/index.html?trace=${encodeURIComponent(location.origin + r.trace)}` : null);
function tabExecution(run) {
  const st = run.stages.find((x) => x.key === 'execution');
  const running = st.status === 'running';
  const canRerun = run.scripts && !run.active && ['completed', 'failed'].includes(run.status);
  const watch = `<div class="panel"><div class="panel-title" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span>Watch the execution agent${running ? ' · live' : ''}</span>
      ${canRerun ? `<span style="display:flex;gap:10px;align-items:center;text-transform:none;letter-spacing:0;font-weight:400"><label class="small"><input type="checkbox" id="rerun-slow" checked> slow motion</label><button class="btn sm" id="rerun-exec">▶ Run execution again</button></span>` : ''}</div>
    ${running ? `<p class="small muted">Live frames from each headless Chromium browser, refreshed several times a second${run.config.slowMo ? ' (slow motion)' : ''}.</p><div id="live">${liveHtml()}</div>`
      : st.status === 'pending' || st.status === 'waiting' ? '<p class="muted small">The live view opens here when the execution agent starts.</p>'
      : `<p class="small muted">Each automation test case was recorded. Use <b>▶ Recording</b> to watch the browser video, or <b>Step-by-step</b> for the Playwright trace (every action with before/after snapshots, network and console).${canRerun ? ' Run execution again to watch it live.' : ''}</p>`}</div>`;
  const e = run.execution; if (!e) return watch + (running ? '' : pending('Execution agent'));
  return `${watch}<div class="grid5" style="margin-bottom:16px">${metricCard('Automation test cases passed', `${e.passed}/${e.passed + e.failed}`, 'real Playwright runs', e.failed ? 'bad' : 'ok')}${metricCard('Failed', e.failed, 'with screenshot and trace', e.failed ? 'bad' : '')}${metricCard('Skipped', e.skipped, 'unresolved steps')}${metricCard('Duration', `${(e.durationMs / 1000).toFixed(1)}s`, `${e.workers || 4} workers${e.slowMo ? ` · slow motion ${e.slowMo} ms` : ''}`)}${metricCard('Browser', 'Chromium', 'headless · video and trace on')}</div>
    <div class="panel"><div class="panel-title" style="display:flex;justify-content:space-between;align-items:center"><span>Results${running ? ' (previous run)' : ''} · ${esc(e.baseUrl)} · ${when(e.finishedAt)}</span><a class="btn secondary sm" href="${e.htmlReport}" target="_blank" rel="noopener">Playwright HTML report</a></div>
    <table><thead><tr><th>Automation test case</th><th>Result</th><th>Duration</th><th>Watch</th><th>Details</th></tr></thead><tbody>
    ${e.results.map((r) => `<tr><td><span class="mono">${esc(r.tcId)}</span> ${esc(r.title.replace(/^TC-\d+\s*/, ''))}</td><td>${pill(r.status)}</td><td>${(r.durationMs / 1000).toFixed(1)}s</td>
      <td class="nowrap">${r.video ? `<button class="btn secondary sm" data-video="${esc(r.video)}" data-title="${esc(r.title)}">▶ Recording</button>` : ''} ${traceViewer(run, r) ? `<a class="btn secondary sm" href="${traceViewer(run, r)}" target="_blank" rel="noopener">Step-by-step</a>` : ''}</td>
      <td class="small">${r.status === 'failed' ? `<b>Failed at:</b> ${esc(r.failedStep || '')}<pre class="code" style="max-height:140px;margin:6px 0">${esc(r.error)}</pre>${r.screenshot ? `<details><summary>Screenshot</summary><img class="shot" src="${r.screenshot}" alt="Failure screenshot for ${esc(r.tcId)}"></details>` : ''}` : ''}</td></tr>`).join('')}
    </tbody></table></div>`;
}
function playVideo(src, title) {
  const d = document.createElement('dialog'); d.className = 'modal wide';
  d.innerHTML = `<div class="eyebrow">Execution recording</div><h2 style="margin-top:4px">${esc(title)}</h2><video src="${src}" controls autoplay style="width:100%;background:#000;border-radius:2px"></video><p style="margin:12px 0 0"><button class="btn secondary" id="v-close">Close</button></p>`;
  document.body.appendChild(d); d.showModal();
  d.addEventListener('close', () => d.remove()); $('#v-close', d).onclick = () => d.close();
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-video]'); if (b) { e.preventDefault(); playVideo(b.dataset.video, b.dataset.title); } });
function defectsTable(r) {
  return r.defects.length ? `<table><thead><tr><th>Defect</th><th>Severity</th><th>Summary</th><th>Stories</th><th>Source</th><th>Evidence</th></tr></thead><tbody>${r.defects.map((d) => `<tr><td>${d.jiraKey ? jiraLink(d.jiraKey) : esc(d.id)}</td><td>${pill(d.severity)}</td><td><b>${esc(d.title)}</b><div class="small muted">${esc(d.actual)}</div></td><td>${d.storyKeys.map(jiraLink).join(', ')}</td><td class="small">Failed automation test case ${esc(d.tcId)}</td><td class="small">${d.screenshot ? `<a href="${d.screenshot}" target="_blank">screenshot</a>` : ''}${d.trace ? ` · <a href="${d.trace}">trace</a>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No defects. Defects are raised only from real failures.</p>';
}
const tabDefects = (run) => (run.report ? `<div class="panel"><div class="panel-title">Defects raised from failed test cases</div>${defectsTable(run.report)}</div>${run.report.notRaised?.length ? `<div class="panel"><div class="panel-title">Failures not raised as defects (execution review)</div><table class="grid"><thead><tr><th>Test case</th><th>Failure</th><th>Reason</th><th>Decided by</th></tr></thead><tbody>${run.report.notRaised.map((d) => `<tr><td class="mono">${esc(d.tcId)}</td><td><b>${esc(d.title)}</b><div class="small muted">${esc(d.actual)}</div></td><td>${esc(d.reason || '–')}</td><td>${esc(d.decidedBy || '')}</td></tr>`).join('')}</tbody></table></div>` : ''}` : pending('Reporting agent'));
function tabExecReview(run) {
  const e = run.execution; if (!e) return pending('Execution agent');
  const gate = run.status === 'awaiting-execution-review'; const xr = run.execReview;
  const failed = e.results.filter((r) => r.status === 'failed');
  const manual = run.testCases.filter((t) => t.automation === 'Manual');
  const decOf = (id) => xr?.defects?.find((d) => d.tcId === id); const manOf = (id) => xr?.manual?.find((m) => m.tcId === id);
  const head = gate ? `<div class="banner action"><b>Your execution review, ${esc(run.config.reviewer || 'reviewer')}.</b> For each failed test, decide whether a defect is raised in Jira. Record the result of each manual test case. Then approve to generate the report.${run.config.raiseDefects === false ? ' Raise defects in Jira is off for this cycle, so approved defects are recorded in the report only.' : ''}</div>`
    : xr?.approvedBy ? `<div class="banner ok">Execution review approved by <b>${esc(xr.approvedBy)}</b> at ${when(xr.approvedAt)}${xr.note ? ` · "${esc(xr.note)}"` : ''}</div>`
    : run.report ? '<div class="banner">This cycle finished before the execution review step existed. Every failure was raised as a defect and manual cases were not recorded.</div>'
    : '<div class="banner">The execution review opens when the execution agent finishes.</div>';
  const failRows = failed.map((r) => { const d = decOf(r.tcId); return `<tr><td><span class="mono">${esc(r.tcId)}</span> ${esc(r.title.replace(/^TC-\d+\s*/, ''))}</td>
    <td class="small"><b>Failed at:</b> ${esc(r.failedStep || '')}<div class="muted">${esc((r.error || '').split('\n').filter(Boolean).slice(0, 2).join(' · ').slice(0, 240))}</div>${r.triage ? `<div style="margin-top:6px">${pill(r.triage.raiseDefect ? 'failed' : 'manual', r.triage.category)} <b>Devin triage</b>${r.triage.confidence ? ` (${esc(r.triage.confidence)} confidence)` : ''}: ${esc(r.triage.rationale || '')}${r.triage.suggestedFix ? `<div class="muted">Suggested fix: ${esc(r.triage.suggestedFix)}</div>` : ''}</div>` : ''}${r.screenshot ? `<a href="${r.screenshot}" target="_blank" rel="noopener">screenshot</a>` : ''}</td>
    <td>${gate ? `<select class="xr-raise" data-tc="${esc(r.tcId)}" aria-label="Defect decision for ${esc(r.tcId)}"><option value="yes">Raise defect in Jira</option><option value="no" ${r.triage && !r.triage.raiseDefect ? 'selected' : ''}>Don't raise</option></select>` : d ? (d.raise ? pill('failed', 'Raise defect') : pill('manual', 'Not raised')) : pill('failed', 'Raise defect')}</td>
    <td>${gate ? `<input type="text" class="xr-reason" data-tc="${esc(r.tcId)}" aria-label="Reason for ${esc(r.tcId)}" placeholder="Reason, e.g. test data issue" value="${r.triage && !r.triage.raiseDefect ? esc(`Devin triage: ${r.triage.category}`) : ''}">` : esc(d?.reason || '–')}</td></tr>`; }).join('');
  const manRows = manual.map((t) => { const m = manOf(t.id); return `<tr><td><span class="mono">${esc(t.id)}</span> ${esc(t.title)}<div>${levelPill(run, t)}</div></td>
    <td class="small"><details><summary>${t.steps.length} step(s)</summary><ol style="margin:6px 0 0 18px;padding:0">${t.steps.map((x) => `<li>${esc(x.action)}${x.expected ? ` → <i>${esc(x.expected)}</i>` : ''}</li>`).join('')}</ol></details></td>
    <td>${gate ? `<select class="xr-result" data-tc="${esc(t.id)}" aria-label="Manual result for ${esc(t.id)}"><option value="not run">Not run</option><option value="passed">Passed</option><option value="failed">Failed</option></select>` : pill(m?.status || 'not run')}</td>
    <td>${gate ? `<input type="text" class="xr-comment" data-tc="${esc(t.id)}" aria-label="Comment for ${esc(t.id)}" placeholder="Comment (optional)">` : esc(m?.comment || '–')}</td>
    <td>${gate ? `<label class="small"><input type="checkbox" class="xr-defect" data-tc="${esc(t.id)}"> raise if failed</label>` : m?.raiseDefect ? 'Yes' : '–'}</td></tr>`; }).join('');
  return `${head}
  <div class="panel"><div class="panel-title">Failed automated tests · defect decision</div>${failed.length ? `<table class="grid"><thead><tr><th>Test case</th><th>Failure</th><th style="width:190px">Defect in Jira</th><th>Reason</th></tr></thead><tbody>${failRows}</tbody></table>` : `<p class="muted">All ${e.results.length} automated tests passed. There are no defects to decide.</p>`}</div>
  <div class="panel"><div class="panel-title">Manual test cases · result</div>${manual.length ? `<table class="grid"><thead><tr><th>Test case</th><th>Steps</th><th style="width:130px">Result</th><th>Comment</th><th style="width:130px">Defect</th></tr></thead><tbody>${manRows}</tbody></table>` : '<p class="muted">This cycle has no manual test cases.</p>'}
  ${gate ? `<label class="f" for="xr-note">Review note <span class="req" aria-hidden="true">*</span></label><input type="text" id="xr-note" required aria-required="true" placeholder="e.g. Execution results reviewed for release 1.0">
    <p class="hint small" id="xr-note-error" role="alert" style="color:#b3261e;display:none">Enter a review note before you approve.</p>
    <p style="margin-top:12px"><button class="btn gold" id="xr-approve">Approve and generate report</button></p>` : ''}</div>`;
}
const tabActivity = (run) => `<div class="panel"><div class="panel-title">Background activity</div><div class="log" id="log">${run.log.map((l) => `<div class="${l.level}"><span class="t">${time(l.t)}</span> <span class="s">[${esc(l.stage || 'pipeline')}]</span> ${esc(l.msg)}</div>`).join('')}</div></div>`;
const RENDER = { summary: tabSummary, requirements: tabRequirements, analysis: tabAnalysis, testcases: tabTestcases, review: tabReview, scripts: tabScripts, execution: tabExecution, execreview: tabExecReview, defects: tabDefects, activity: tabActivity };

function devinBanner(run) {
  const d = run.devin; if (run.config.engine !== 'devin') return '';
  if (!d) return '<div class="banner">Devin engine · the session is being created…</div>';
  const phase = String(d.phase || 'starting').replace(/_/g, ' ');
  return `<div class="banner devin"><b>Devin engine</b> · <a href="${esc(d.url)}" target="_blank" rel="noopener">Open the Devin session</a> · phase <b>${esc(phase)}</b> · session ${esc(d.status || '')}${d.statusDetail ? ` (${esc(String(d.statusDetail).replace(/_/g, ' '))})` : ''} · ${d.acus != null ? `${Number(d.acus).toFixed(1)} ACUs` : ''}${d.polledAt ? ` · checked ${time(d.polledAt)}` : ''}${d.localRerun ? ' · last execution re-run locally' : ''}</div>`;
}
const aiNote = (title, text) => (text ? `<div class="panel ai-note"><div class="panel-title">${esc(title)} · written by Devin</div><p style="margin:0">${esc(text)}</p></div>` : '');
function renderCycle(tab) {
  const run = state.run; activeNav('cycles');
  const badge = { testcases: run.testCases?.length, review: run.status === 'awaiting-approval' ? '!' : null, execreview: run.status === 'awaiting-execution-review' ? '!' : null, scripts: run.scripts?.generated, execution: run.execution ? `${run.execution.passed}/${run.execution.results.length}` : null, defects: run.report?.defects.length || null };
  const view = $('#view'); const y = window.scrollY;
  const lg = $('#log'); const atBottom = !lg || lg.scrollTop + lg.clientHeight >= lg.scrollHeight - 30;
  const open = $$('details[open]', view).map((d) => d.querySelector('summary')?.textContent);
  const cur = run.stages.find((s) => s.status === 'running');
  view.innerHTML = `${hero(`Cycle ${run.id} · Flow 1 baseline · EQE`, `${run.config.initiative} on StayEase ${run.config.release || ''}`, `${pill(run.status)} ${run.report ? pill(run.report.decision) : ''} · started ${when(run.createdAt)}${run.finishedAt ? ` · finished in ${dur(run.createdAt, run.finishedAt)}` : ''}${run.config.reviewer ? ` · reviewer ${esc(run.config.reviewer)}` : ''}${cur ? ` · <span class="spin"></span> ${esc(cur.agent)} working` : ''}`,
    `${['running', 'queued', 'awaiting-approval', 'awaiting-execution-review'].includes(run.status) ? '<button class="btn secondary" id="cancel">Cancel cycle</button> ' : ''}${run.report ? `<a class="btn" href="#/reporting?cycle=${run.id}">Report</a> <a class="btn secondary" href="#/traceability?cycle=${run.id}">Traceability</a>` : ''}`)}
    ${cur ? `<div class="run-banner" role="status" aria-live="polite"><span class="pulse" aria-hidden="true"></span><b>Running</b><span>${esc(cur.agent)} · ${esc(cur.name)} · <b class="pct">${cur.progress || 0}%</b></span><span class="since">cycle ${cycleProgress(run)}% done · started ${time(cur.startedAt)}</span></div>` : ''}
    ${devinBanner(run)}
    <div class="panel"><div class="panel-title">Workflow</div>${agentCards(run)}</div>
    <nav class="tabs">${TABS.map(([k, l]) => `<a href="#/cycle/${run.id}?tab=${k}" class="${k === tab ? 'on' : ''}">${l}${badge[k] != null ? ` <span class="pill ${['review', 'execreview'].includes(k) ? 'warn' : ''}">${badge[k]}</span>` : ''}</a>`).join('')}</nav>
    <div id="tab">${RENDER[tab](run)}</div>`;
  $$('details', view).forEach((d) => { if (open.includes(d.querySelector('summary')?.textContent)) d.open = true; });
  const lg2 = $('#log'); if (lg2 && atBottom) lg2.scrollTop = lg2.scrollHeight;
  window.scrollTo(0, y);
  const c = $('#cancel'); if (c) c.onclick = async () => { if (confirm(`Cancel ${run.id}?`)) { await api(`/api/runs/${run.id}/cancel`, { method: 'POST' }); refresh(true); } };
  const needNote = () => { const n = $('#note'), e = $('#note-error'); const v = n.value.trim(); e.style.display = v ? 'none' : 'block'; n.setAttribute('aria-invalid', String(!v)); if (!v) n.focus(); return v; };
  const nt = $('#note'); if (nt) nt.oninput = () => { if (nt.value.trim()) { $('#note-error').style.display = 'none'; nt.removeAttribute('aria-invalid'); } };
  const a = $('#approve'); if (a) a.onclick = async () => {
    if (!needNote()) return;
    a.disabled = true;
    const excluded = $$('input.keep').filter((x) => !x.checked).map((x) => x.value);
    try { await api(`/api/runs/${run.id}/approve`, { method: 'POST', body: JSON.stringify({ excluded, note: $('#note').value.trim() }) }); go(`cycle/${run.id}`, { tab: 'summary' }); } catch (e) { alert(e.message); a.disabled = false; }
  };
  const xa = $('#xr-approve'); if (xa) xa.onclick = async () => {
    const n = $('#xr-note'); const note = n.value.trim(); $('#xr-note-error').style.display = note ? 'none' : 'block'; if (!note) { n.focus(); return; }
    const val = (cls, tc) => $(`${cls}[data-tc="${tc}"]`);
    const defects = $$('select.xr-raise').map((x) => ({ tcId: x.dataset.tc, raise: x.value === 'yes', reason: val('input.xr-reason', x.dataset.tc).value.trim() }));
    const manual = $$('select.xr-result').map((x) => ({ tcId: x.dataset.tc, status: x.value, comment: val('input.xr-comment', x.dataset.tc).value.trim(), raiseDefect: val('input.xr-defect', x.dataset.tc).checked }));
    xa.disabled = true;
    try { await api(`/api/runs/${run.id}/approve-execution`, { method: 'POST', body: JSON.stringify({ note, defects, manual }) }); go(`cycle/${run.id}`, { tab: 'summary' }); } catch (e) { alert(e.message); xa.disabled = false; }
  };
  const ad = $('#ac-add'); if (ad) ad.onclick = async () => {
    const err = $('#ac-error');
    const body = { title: $('#ac-title').value, type: $('#ac-type').value, priority: $('#ac-prio').value, preconditions: $('#ac-pre').value,
      acIds: [...$('#ac-acs').selectedOptions].map((o) => o.value),
      steps: $('#ac-steps').value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [action, ...rest] = l.split('|'); return { action: action.trim(), expected: rest.join('|').trim() }; }) };
    const miss = !body.title.trim() ? 'Enter a test case title.' : !body.acIds.length ? 'Pick at least one acceptance criterion.' : !body.steps.length ? 'Enter at least one step.' : '';
    if (miss) { err.textContent = miss; err.style.display = 'block'; return; }
    ad.disabled = true;
    const note = $('#note')?.value || '';
    try { await api(`/api/runs/${run.id}/testcases`, { method: 'POST', body: JSON.stringify(body) }); await refresh(true); const n = $('#note'); if (n) n.value = note; }
    catch (e) { err.textContent = e.message; err.style.display = 'block'; ad.disabled = false; }
  };
  const rj = $('#reject'); if (rj) rj.onclick = async () => {
    const reason = needNote(); if (!reason) return;
    if (!confirm(`Reject the requirement set for ${run.id}? Your review note is recorded as the reason.`)) return;
    try { await api(`/api/runs/${run.id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }); refresh(true); } catch (e) { alert(e.message); }
  };
  if (tab === 'scripts' && run.scripts) loadFiles(run);
  const rr = $('#rerun-exec'); if (rr) rr.onclick = async () => {
    rr.disabled = true;
    try { await api(`/api/runs/${run.id}/rerun-execution`, { method: 'POST', body: JSON.stringify({ slowMo: $('#rerun-slow').checked }) }); state.live = []; await refresh(true); startPolling(); } catch (e) { alert(e.message); rr.disabled = false; }
  };
  clearInterval(state.liveTimer);
  if (tab === 'execution' && run.stages.find((x) => x.key === 'execution').status === 'running') {
    const poll = async () => { try { state.live = await api(`/api/runs/${run.id}/live`); const el = $('#live'); if (el) el.innerHTML = liveHtml(); } catch { /* next tick */ } };
    poll(); state.liveTimer = setInterval(poll, 700);
  }
}
async function loadFiles(run) {
  if (!state.files || state.files.run !== run.id || !state.files.list.length) state.files = { run: run.id, list: await api(`/api/runs/${run.id}/files`) };
  const list = state.files.list;
  const nav = $('#file-list'); if (!nav) return;
  if (!list.length) {
    nav.innerHTML = '';
    $('#file-view').innerHTML = `<div class="empty">${run.scripts?.engine === 'devin' ? 'Devin has written the scripts in its session. They appear here as soon as Devin attaches the automation zip, usually within a minute or two.' : 'No generated files yet.'}</div>`;
    return;
  }
  if (!state.file || !list.includes(state.file)) state.file = list.find((f) => f.startsWith('tests/')) || list[0];
  nav.innerHTML = list.map((f) => `<a href="#" data-f="${esc(f)}" class="${f === state.file ? 'on' : ''}">${esc(f)}</a>`).join('');
  $$('a', nav).forEach((el) => { el.onclick = (e) => { e.preventDefault(); state.file = el.dataset.f; loadFiles(run); }; });
  $$('[data-file]').forEach((el) => { el.onclick = (e) => { e.preventDefault(); state.file = el.dataset.file; loadFiles(run); $('#files-panel').scrollIntoView({ behavior: 'smooth' }); }; });
  const res = await fetch(`/api/runs/${run.id}/file?path=${encodeURIComponent(state.file)}`);
  const src = res.ok ? await res.text() : `Could not load ${state.file}.`;
  $('#file-view').innerHTML = `<div class="small muted" style="margin-bottom:6px">${esc(state.file)}</div><pre class="code">${esc(src)}</pre>`;
}

// ---------- Reporting ----------
async function viewReporting(q) {
  activeNav('reporting');
  const pick = await cyclePicker('reporting', q);
  let body = '';
  if (pick.id) {
    const run = await api(`/api/runs/${pick.id}`); const r = run.report; const m = r.metrics; const c = r.criteria;
    const t = run.analysis.totals; const s = run.scripts;
    const exit = [
      ['Automation pass rate', `≥ ${c.minAutomationPassRate}%`, `${m.passRate}%`, m.passRate >= c.minAutomationPassRate],
      ['Acceptance criteria coverage', `≥ ${c.minAcceptanceCriteriaCoverage}%`, `${m.acCoverage}%`, m.acCoverage >= c.minAcceptanceCriteriaCoverage],
      [`No open ${c.noGoSeverities.join('/')} defects`, '0', String(r.defects.filter((d) => c.noGoSeverities.includes(d.severity)).length), !r.defects.some((d) => c.noGoSeverities.includes(d.severity))],
      [`Open ${c.conditionalSeverities.join('/')} defects`, '0 for Go', String(r.defects.filter((d) => c.conditionalSeverities.includes(d.severity)).length), !r.defects.some((d) => c.conditionalSeverities.includes(d.severity))],
    ];
    const evidence = [
      ['Every automation test case ran in a real browser', m.executed === m.automated && m.automated > 0],
      ['Every failure has a screenshot and a trace', run.execution.results.filter((x) => x.status === 'failed').every((x) => x.screenshot && x.trace)],
      ['Every defect is linked to a Jira story', r.defects.every((d) => d.storyKeys.length)],
      ['Every acceptance criterion is covered by a test case', m.acCoverage === 100],
      ['Test cases were approved by a person before automation', !!run.review?.approvedBy],
    ];
    const statusOf = Object.fromEntries(r.storyStatus.map((x) => [x.key, x.status]));
    body = `
      <div class="outcome"><span class="big ${r.decision}">${esc(r.decision)}</span><div><b>StayEase ${esc(r.release || '')} · ${esc(run.config.initiative)} · ${esc(run.id)}</b><ul>${r.reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></div>
      <div class="grid5" style="margin-bottom:16px">
        ${metricCard('Requirements', `${m.stories} stories`, `${m.acs} acceptance criteria · ${t.ambiguous} ambiguous · no gap check (EQE)`)}
        ${metricCard('Test design', `${m.testCases} test cases`, `${run.design.automation} automatable · ${run.design.manual} manual · AC coverage ${m.acCoverage}%`)}
        ${metricCard('Automation scripts', s.generated, `${s.pageObjects.length} page objects${s.mcpCalls == null ? '' : ` · ${s.mcpCalls} MCP calls`}`)}
        ${metricCard('Execution', `${m.passed}/${m.executed}`, `Automation pass rate ${m.passRate}%`, m.failed ? 'bad' : 'ok')}
        ${metricCard('Defects', m.defects, r.defects.map((d) => `${d.jiraKey || d.id} ${d.severity}`).join(', ') || 'none open', m.defects ? 'bad' : 'ok')}
      </div>
      <div class="grid2">
        <div class="panel"><div class="panel-title">Exit criteria · sign-off owner: ${esc(r.signOffOwner)}</div><table><thead><tr><th>Criterion</th><th>Target</th><th>Actual</th><th></th></tr></thead><tbody>${exit.map(([n, tg, ac, ok]) => `<tr><td>${esc(n)}</td><td>${esc(tg)}</td><td><b>${esc(ac)}</b></td><td>${pill(ok ? 'ok' : 'bad', ok ? 'Met' : 'Not met')}</td></tr>`).join('')}</tbody></table>
          <p class="small muted" style="margin-top:8px">Reviewer: ${esc(run.review?.approvedBy || run.config.reviewer || '–')}</p></div>
        <div class="panel"><div class="panel-title">Evidence check</div><table><tbody>${evidence.map(([n, ok]) => `<tr><td>${esc(n)}</td><td style="width:90px">${pill(ok ? 'ok' : 'bad', ok ? 'Yes' : 'No')}</td></tr>`).join('')}</tbody></table></div>
      </div>
      <div class="panel"><div class="panel-title">Business-flow readiness · guest journey</div><ol class="lifecycle" style="grid-template-columns:repeat(${run.analysis.journey.length},1fr)">${run.analysis.journey.map((j) => {
        const sts = j.stories.map((k) => statusOf[k]); const st = sts.includes('Failed') ? 'Failed' : sts.every((x) => x === 'Passed') ? 'Passed' : 'Passed with manual checks';
        return `<li><span class="lc-k">${pill(st, st === 'Passed with manual checks' ? 'Manual checks' : st)}</span><b>${esc(j.label)}</b><span class="d">${j.stories.map((k) => `${jiraLink(k)} ${esc(statusOf[k] || '')}`).join('<br>')}</span></li>`;
      }).join('')}</ol></div>
      <div class="panel"><div class="panel-title">Defects and risks</div><h3>Defects from failed automation test cases</h3>${defectsTable(r)}
        <h3>Risks</h3><ul class="small">${run.analysis.stories.flatMap((x) => x.findings.filter((f) => f.level !== 'low').map((f) => `<li>${jiraLink(x.key)} ${esc(f.text)}</li>`)).join('') || '<li>None</li>'}${r.trace.filter((x) => x.status === 'Manual').map((x) => `<li>${jiraLink(x.storyKey)} ${esc(x.acId)} needs manual verification (${esc(x.testability)})</li>`).join('')}</ul></div>
      <div class="panel"><div class="panel-title">Story status</div><table><thead><tr><th>Story</th><th>Priority</th><th>Status</th><th>AC passed / failed / manual</th></tr></thead><tbody>${r.storyStatus.map((x) => `<tr><td>${jiraLink(x.key)} ${esc(x.summary)}</td><td>${esc(x.priority)}</td><td>${pill(x.status)}</td><td>${x.passed} / ${x.failed} / ${x.manual} <span class="muted">of ${x.acs}</span></td></tr>`).join('')}</tbody></table></div>
      <div class="panel"><div class="panel-title">Release criteria applied</div><p class="small">From <code>dashboard/config/release-criteria.json</code>: minimum automation pass rate <b>${c.minAutomationPassRate}%</b>, minimum AC coverage <b>${c.minAcceptanceCriteriaCoverage}%</b>, No-go severities <b>${esc(c.noGoSeverities.join(', '))}</b>, Conditional severities <b>${esc(c.conditionalSeverities.join(', '))}</b>. EQE has no gap check, so gap defects do not apply.</p></div>
      <div class="panel"><div class="panel-title">Downloads</div><div class="downloads">
        <a class="btn secondary sm" href="/api/runs/${run.id}/report.xlsx">Cycle report (Excel)</a><a class="btn secondary sm" href="/api/runs/${run.id}/export/testcases.xlsx">Test cases (Zephyr Scale Excel)</a>
        <a class="btn secondary sm" href="/api/runs/${run.id}/lead-report.html" target="_blank">QE lead report (HTML)</a><a class="btn secondary sm" href="/api/runs/${run.id}/lead-report.md">QE lead report (Markdown)</a>
        <a class="btn secondary sm" href="${run.execution.htmlReport}" target="_blank" rel="noopener">Playwright HTML report</a></div></div>`;
  }
  $('#view').innerHTML = hero('Reporting', 'Quality reports by cycle', 'Pick a cycle to read its QE lead report: the release decision, exit criteria, evidence, business-flow readiness, defects and risks, or download them.') + pick.html + body;
  bindPicker('reporting', q);
}

// ---------- Traceability ----------
async function viewTraceability(q) {
  activeNav('traceability');
  const pick = await cyclePicker('traceability', q, (r) => r.decision || r.status.startsWith('awaiting'));
  const by = ['design', 'requirement', 'testcase', 'script', 'defect', 'journey'].includes(q.by) ? q.by : 'testcase';
  let body = '';
  if (pick.id) {
    const run = await api(`/api/runs/${pick.id}`); const r = run.report;
    if (!r || by === 'design') {
      const tabsD = r ? [['testcase', 'By test case'], ['design', 'Before approval'], ['requirement', 'By requirement'], ['script', 'By script'], ['defect', 'By defect'], ['journey', 'Journey']] : [['design', 'Before approval']];
      body = `<div class="subtabs">${tabsD.map(([k, l]) => `<a href="#/traceability?cycle=${pick.id}&by=${k}" class="${k === 'design' ? 'on' : ''}">${l}</a>`).join('')}</div>${r ? '' : `<div class="banner action"><b>${esc(run.id)} is waiting for ${run.status === 'awaiting-execution-review' ? 'the execution review' : 'human review'}.</b> This matrix is generated by the Test design agent; results appear here after approval and execution. <a class="btn sm" href="#/cycle/${run.id}?tab=review" style="margin-left:8px">Review</a></div>`}${designMatrix(run)}`;
    } else {
    const res = Object.fromEntries([...run.execution.results.map((x) => [x.tcId, x]), ...(r.manualResults || []).filter((m) => m.status !== 'not run').map((m) => [m.tcId, { status: m.status }])]);
    const scr = Object.fromEntries(run.scripts.cases.map((x) => [x.tcId, x]));
    const defOf = (tcId) => r.defects.filter((d) => d.tcId === tcId).map((d) => (d.jiraKey ? jiraLink(d.jiraKey) : esc(d.id))).join(', ') || '–';
    const sub = `<div class="subtabs">${[['testcase', 'By test case'], ['design', 'Before approval'], ['requirement', 'By requirement'], ['script', 'By script'], ['defect', 'By defect'], ['journey', 'Journey']].map(([k, l]) => `<a href="#/traceability?cycle=${pick.id}&by=${k}" class="${k === by ? 'on' : ''}">${l}</a>`).join('')}</div>`;
    let table = '';
    if (by === 'requirement') table = `<table class="grid"><thead><tr><th>Story</th><th>Acceptance criterion</th><th>Test cases</th><th>Scripts</th><th>Result</th><th>Defects</th></tr></thead><tbody>${r.trace.map((t) => `<tr><td>${jiraLink(t.storyKey)}</td><td style="max-width:440px"><span class="mono muted">${esc(t.acId)}</span> ${esc(t.acText)}</td><td class="small">${t.tests.map((x) => `<div><span class="mono">${x.id}</span> ${pill(x.result)}</div>`).join('') || '–'}</td><td class="small mono">${t.tests.filter((x) => x.script).map((x) => `<div><a href="#/cycle/${run.id}?tab=scripts">${esc(x.script.replace('tests/', ''))}</a></div>`).join('') || '–'}</td><td>${pill(t.status)}</td><td>${t.defects.map((k) => (k.startsWith('DEF') ? esc(k) : jiraLink(k))).join(', ') || '–'}</td></tr>`).join('')}</tbody></table>`;
    if (by === 'testcase') {
      const storyCols = run.analysis.stories.map((x) => x.key);
      const cell = (t, k) => (!t.storyKeys.includes(k) ? '' : res[t.id] ? pill(res[t.id].status) : pill('manual', t.automation === 'Manual' ? 'manual' : 'not run'));
      table = `<p class="small muted" style="margin-top:0">Rows are test cases, columns are Jira stories. A cell shows the test case's result for each story it covers; a greyed-out cell (–) means the story is not applicable to that test case.</p><div class="table-scroll"><table class="matrix"><thead><tr><th>Test case</th><th>Type</th><th>Level</th>${storyCols.map((k) => `<th class="story">${jiraLink(k)}</th>`).join('')}<th>Acceptance criteria</th><th>Script</th><th>Defects</th></tr></thead><tbody>${run.testCases.map((t) => `<tr><td><span class="mono">${t.id}</span> ${esc(t.title)}</td><td>${pill(t.automation)}</td><td>${levelPill(run, t)}</td>${storyCols.map((k) => (t.storyKeys.includes(k) ? `<td class="cell">${cell(t, k)}</td>` : '<td class="cell na" title="Not applicable: this test case does not cover this story" aria-label="Not applicable">–</td>')).join('')}<td class="mono small">${t.acIds.join(', ')}</td><td class="mono small">${scr[t.id] ? esc(scr[t.id].file) : '–'}</td><td>${defOf(t.id)}</td></tr>`).join('')}</tbody></table></div>`;
    }
    if (by === 'script') table = `<table class="grid"><thead><tr><th>Script</th><th>Test case</th><th>Page objects used</th>${run.scripts.mcpCalls == null ? '' : '<th>MCP calls</th>'}<th>Result</th><th>Duration</th></tr></thead><tbody>${run.scripts.cases.map((c) => `<tr><td class="mono">${esc(c.file)}</td><td class="mono">${c.tcId}</td><td class="small">${[...new Set(c.steps.map((x) => x.page).filter(Boolean))].join(', ')}</td>${run.scripts.mcpCalls == null ? '' : `<td>${c.mcpCalls ?? 0}</td>`}<td>${res[c.tcId] ? pill(res[c.tcId].status) : '–'}</td><td>${res[c.tcId] ? `${(res[c.tcId].durationMs / 1000).toFixed(1)}s` : ''}</td></tr>`).join('')}</tbody></table>`;
    if (by === 'defect') table = r.defects.length ? `<table class="grid"><thead><tr><th>Defect</th><th>Severity</th><th>Stories</th><th>Acceptance criteria</th><th>Test case</th><th>Script</th><th>Failed step</th></tr></thead><tbody>${r.defects.map((d) => `<tr><td>${d.jiraKey ? jiraLink(d.jiraKey) : esc(d.id)}</td><td>${pill(d.severity)}</td><td>${d.storyKeys.map(jiraLink).join(', ')}</td><td class="mono small">${d.acIds.join(', ')}</td><td class="mono">${d.tcId}</td><td class="mono small">${esc(scr[d.tcId]?.file || '')}</td><td class="small">${esc(d.expected || '')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No defects in this cycle.</p>';
    if (by === 'journey') table = `<table class="grid nostripe"><thead><tr><th>Journey stage</th><th>Story</th><th>Test cases and results</th></tr></thead><tbody>${run.analysis.journey.map((j, n) => j.stories.map((k, si) => { const tcs = run.testCases.filter((t) => t.storyKeys.includes(k)); return `<tr>${si ? '' : `<td rowspan="${j.stories.length}"><span class="mono muted">${n + 1}</span> <b>${esc(j.label)}</b></td>`}<td>${jiraLink(k)}</td><td>${tcs.map((t) => `<span class="nowrap" style="display:inline-block;margin:2px 10px 2px 0"><span class="mono">${t.id}</span> ${res[t.id] ? pill(res[t.id].status) : pill('manual', 'manual')}</span>`).join('') || '–'}</td></tr>`; }).join('') || `<tr><td><span class="mono muted">${n + 1}</span> <b>${esc(j.label)}</b></td><td colspan="2" class="muted">No stories</td></tr>`).join('')}</tbody></table>`;
    body = `${sub}<div class="panel">${table}</div>`;
    }
  }
  $('#view').innerHTML = hero('Traceability', 'Requirement → test case → script → result → defect', 'Every acceptance criterion in Jira is followed through the designed test cases, the generated Playwright scripts, the real results and any defects.') + pick.html + body;
  bindPicker('traceability', { by });
}

// ---------- Compare ----------
async function viewCompare(q) {
  activeNav('compare');
  const list = completed();
  if (list.length < 2) { $('#view').innerHTML = hero('Compare', 'Compare two cycles', '') + '<p class="muted">Compare needs at least two completed cycles. <a href="#/run">Run a cycle</a>.</p>'; return; }
  const a = list.some((r) => r.id === q.a) ? q.a : list[1].id; const b = list.some((r) => r.id === q.b) ? q.b : list[0].id;
  const [A, B] = await Promise.all([api(`/api/runs/${a}`), api(`/api/runs/${b}`)]);
  const opt = (sel) => list.map((r) => `<option value="${r.id}" ${r.id === sel ? 'selected' : ''}>${r.id} · StayEase ${esc(r.release || '')} · ${esc(r.decision)}</option>`).join('');
  const rows = [
    ['Release decision', (x) => x.report.decision], ['StayEase release', (x) => x.report.release], ['Stories', (x) => x.report.metrics.stories], ['Acceptance criteria', (x) => x.report.metrics.acs],
    ['Test cases', (x) => x.report.metrics.testCases], ['Automation scripts', (x) => x.report.metrics.automated], ['Automation test cases passed', (x) => `${x.report.metrics.passed}/${x.report.metrics.executed}`],
    ['Automation pass rate', (x) => x.report.metrics.passRate, true], ['AC coverage', (x) => x.report.metrics.acCoverage, true], ['Defects', (x) => x.report.metrics.defects, false, true], ['Playwright MCP calls', (x) => x.report.metrics.mcpCalls ?? 'not used'],
  ];
  const resA = Object.fromEntries(A.execution.results.map((x) => [x.tcId, x.status])); const resB = Object.fromEntries(B.execution.results.map((x) => [x.tcId, x.status]));
  const changed = [...new Set([...Object.keys(resA), ...Object.keys(resB)])].filter((k) => resA[k] !== resB[k]);
  $('#view').innerHTML = hero('Compare', 'Compare two cycles', 'See how the release decision, results and defects moved between two cycles, for example release 1.0 against release 1.1.') + `
    <div class="cycle-picker"><div class="field"><label class="f" for="ca">Earlier cycle</label><select id="ca">${opt(a)}</select></div><div class="field"><label class="f" for="cb">Later cycle</label><select id="cb">${opt(b)}</select></div></div>
    <div class="panel"><table class="cmp"><thead><tr><th>Measure</th><th>${a}</th><th>${b}</th></tr></thead><tbody>${rows.map(([n, f, up, down]) => { const x = f(A); const y = f(B); const cls = up ? (y > x ? 'better' : y < x ? 'worse' : '') : down ? (y < x ? 'better' : y > x ? 'worse' : '') : ''; return `<tr><td>${n}</td><td>${esc(x)}${up ? '%' : ''}</td><td class="${cls}">${esc(y)}${up ? '%' : ''}</td></tr>`; }).join('')}</tbody></table></div>
    <div class="panel"><div class="panel-title">Automation test cases whose result changed</div>${changed.length ? `<table><thead><tr><th>Test case</th><th>${a}</th><th>${b}</th></tr></thead><tbody>${changed.map((k) => `<tr><td class="mono">${k}</td><td>${pill(resA[k] || 'not run')}</td><td>${pill(resB[k] || 'not run')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No result changed.</p>'}</div>
    <div class="panel"><div class="panel-title">Defects</div><p class="small"><b>${a}:</b> ${A.report.defects.map((d) => `${d.jiraKey ? jiraLink(d.jiraKey) : d.id} ${esc(d.severity)}`).join(', ') || 'none'}<br><b>${b}:</b> ${B.report.defects.map((d) => `${d.jiraKey ? jiraLink(d.jiraKey) : d.id} ${esc(d.severity)}`).join(', ') || 'none'}</p></div>`;
  $('#ca').onchange = () => go('compare', { a: $('#ca').value, b: $('#cb').value }); $('#cb').onchange = $('#ca').onchange;
}

// ---------- routing and polling ----------
async function refresh(force) {
  const { parts, q } = parseHash();
  if (parts[0] !== 'cycle' || !state.run) return;
  const run = await api(`/api/runs/${parts[1]}`);
  if (force || run.updatedAt !== state.lastUpdate) { state.run = run; state.lastUpdate = run.updatedAt; renderCycle(RENDER[q.tab] ? q.tab : 'summary'); }
}
function startPolling() {
  clearInterval(state.timer);
  state.timer = setInterval(() => { if (state.run && (state.run.active || ['running', 'queued'].includes(state.run.status))) refresh().catch(() => {}); }, 1500);
}
async function route() {
  clearInterval(state.timer); clearInterval(state.liveTimer);
  const { parts, q } = parseHash();
  await loadRuns().catch(() => {});
  try {
    if (parts[0] === 'cycle' && parts[1]) {
      try { state.run = await api(`/api/runs/${parts[1]}`); } catch { $('#view').innerHTML = '<div class="panel empty">Cycle not found</div>'; return; }
      state.lastUpdate = state.run.updatedAt;
      renderCycle(RENDER[q.tab] ? q.tab : 'summary');
      startPolling();
      return;
    }
    state.run = null;
    if (parts[0] === 'run') viewRun();
    else if (parts[0] === 'cycles') viewCycles();
    else if (parts[0] === 'reporting') await viewReporting(q);
    else if (parts[0] === 'traceability') await viewTraceability(q);
    else if (parts[0] === 'compare') await viewCompare(q);
    else viewHome();
  } catch (e) { $('#view').innerHTML = `<div class="banner bad">${esc(e.message)}</div>`; }
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
loadConfig().then(route);
setInterval(loadConfig, 30000);
