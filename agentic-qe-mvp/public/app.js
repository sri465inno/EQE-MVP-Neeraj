'use strict';
/* Agentic QE Platform - MVP - plain JS front end (hash routing, no framework). */
const TITLE = 'Agentic QE Platform - MVP';
const $view = document.getElementById('view');
let META = null;
let pollTimer = null;
const runState = { type: 'baseline', baselineId: '', inputs: {}, skills: null };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pill = (text, cls) => `<span class="pill ${esc(cls || String(text).replace(/\s+/g, '-'))}">${esc(text)}</span>`;
const fmtTime = (t) => (t ? new Date(t).toLocaleString() : '-');

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error((data && data.error) || res.statusText);
  return data;
}

function table(headers, rows, rowClass) {
  if (!rows.length) return '<p class="muted">None.</p>';
  return `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr class="${rowClass ? esc(rowClass(i)) : ''}">${r.map((c) => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
const PROV_TEXT = { live: 'live Jira call', github: 'pulled live from GitHub', fixture: 'recorded fixture', pasted: 'pasted' };
const provPill = (p) => pill(PROV_TEXT[p.kind] || p.kind, p.kind);
const artPill = (s) => pill(s, s === 'carried over' ? 'carried' : s);

function setTitle(sub) { document.title = sub ? `${sub} - ${TITLE}` : TITLE; }
function activeNav(route) {
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#/${route}` || (route === '' && a.getAttribute('href') === '#/')));
}

async function loadMeta() {
  META = await api('/api/meta');
}

function modesHtml() {
  return [
    META.jira.mode === 'live' ? pill(`Jira: live (${META.jira.baseUrl})`, 'live') : `<span title="${esc(META.jira.note)}">${pill(`Jira: synthetic export on GitHub (${META.jiraExport.branch}) or recorded fixture; live Jira not configured`, 'github')}</span>`,
    pill(`Source: GitHub ${META.codebase.repo}`, 'github'),
    META.model.mode === 'model' ? pill(`Prose: ${META.model.model}`, 'live') : `<span title="${esc(META.model.note)}">${pill('Prose: deterministic demo mode', 'demo')}</span>`,
  ].join('');
}

/* ---------------- Home ---------------- */
const selectedSkills = () => runState.skills || META.skills.map((s) => s.id);
const ownes = (s) => Object.entries(s.delivers).map(([a, keys]) => `${a}: ${keys.join(', ')}`).join(' · ');

function skillsCard() {
  const on = new Set(selectedSkills());
  return `<div class="card"><p class="muted small">Markdown skill files loaded from <code>skills/</code> at startup. A skill's text is given only to the agents it names; after each phase, what the phase produced is checked against what the skill says it owes. All are on by default. <span id="skill-count">${on.size} of ${META.skills.length} selected</span></p>
${META.skillWarnings && META.skillWarnings.length ? `<div class="banner">${META.skillWarnings.map(esc).join('<br>')}</div>` : ''}
<div class="skills">${META.skills.map((s) => `<label class="skill"><input type="checkbox" class="skill-on" value="${esc(s.id)}" ${on.has(s.id) ? 'checked' : ''}> <b>${esc(s.name)}</b> <code class="small">${esc(s.id)}</code><br><span class="small">${esc(s.description)}</span><br><span class="small muted">seen by: ${esc(s.appliesTo.join(', '))} · owes: ${esc(ownes(s))}</span></label>`).join('')}</div></div>`;
}

function handoverBadge(p) {
  const h = p.handover;
  if (!h || h.status === 'no contract') return p.skills && p.skills.length ? `<br><span class="small muted">skills: ${esc(p.skills.join(', '))}</span>` : '';
  return `<br><span class="hand ${h.status === 'complete' ? 'ok' : 'bad'}" title="${esc(h.items.map((i) => `${i.key}: ${i.status}`).join('\n'))}">hand-over ${esc(h.status)}${h.status === 'complete' ? ` (${h.items.filter((i) => i.status === 'delivered').length}/${h.items.length})` : `: missing ${esc(h.missing.join(', '))}`}</span>`;
}

function skillsView(c) {
  const skills = c.skills || [];
  const phases = c.phases.filter((p) => p.handover || (p.skills && p.skills.length));
  return `<h2>Active skills (${skills.length})</h2>${skills.length ? table(['Skill', 'Description', 'Seen by agents', 'Owes', 'File'], skills.map((s) => [`<b>${esc(s.name)}</b><br><code class="small">${esc(s.id)}</code>`, esc(s.description), esc(s.appliesTo.join(', ')), esc(ownes(s)), `<span class="small">${esc(s.file)} · ${esc(s.sha256)}</span>`])) : '<p class="muted">No skills were selected for this run.</p>'}
<h2>Hand-overs per phase</h2>${table(['Phase', 'Skills seen', 'Hand-over', 'Artefacts owed'], phases.map((p) => [esc(p.label), esc((p.skills || []).join(', ') || '-'), p.handover ? `<span class="hand ${p.handover.status === 'complete' ? 'ok' : p.handover.status === 'incomplete' ? 'bad' : ''}">${esc(p.handover.status)}</span>` : '-',
    p.handover ? p.handover.items.map((i) => `${esc(i.key)}: <b>${esc(i.status)}</b>${i.count != null ? ` (${i.count})` : ''} <span class="small muted">${esc(i.skills.join(', '))}${i.note ? ` - ${esc(i.note)}` : ''}</span>`).join('<br>') : '-']))}
${skills.map((s) => `<details><summary><b>${esc(s.name)}</b> <span class="small muted">skill text</span></summary><pre class="skillbody">${esc(s.body)}</pre></details>`).join('')}`;
}

/* ---------------- rails and tiles ---------------- */
function tile({ href = '', detail = '', art = '', tag = '', big = '', corner = '', title, lines = [], extra = '', cls = '', progress = null }) {
  const attrs = href ? `href="${esc(href)}"` : `href="#" data-detail="${esc(detail)}"`;
  return `<a class="tile ${esc(cls)}" ${attrs}><div class="art ${esc(art)}">${tag ? `<span class="tag">${esc(tag)}</span>` : ''}<span class="big">${esc(big)}</span>${corner ? `<span class="corner">${corner}</span>` : ''}</div>
${progress != null ? `<div class="bar"><i style="width:${Math.max(0, Math.min(100, progress))}%"></i></div>` : ''}<div class="body"><b class="t">${esc(title)}</b>${lines.join('<br>')}${extra}</div></a>`;
}
function rail(id, title, note, tiles) {
  return `<section class="rail" id="rail-${esc(id)}"><div class="rail-head"><h2>${esc(title)}</h2>${note ? `<span class="muted small">${note}</span>` : ''}</div>
<div class="rail-wrap"><button class="rail-btn prev" aria-label="Scroll left">&#8249;</button><div class="rail-track">${tiles.join('')}</div><button class="rail-btn next" aria-label="Scroll right">&#8250;</button></div><div class="rail-detail"></div></section>`;
}
function updateRails() {
  document.querySelectorAll('.rail-track').forEach((t) => {
    const w = t.parentElement;
    w.classList.toggle('can-prev', t.scrollLeft > 4);
    w.classList.toggle('can-next', t.scrollLeft + t.clientWidth < t.scrollWidth - 4);
    t.onscroll = () => { w.classList.toggle('can-prev', t.scrollLeft > 4); w.classList.toggle('can-next', t.scrollLeft + t.clientWidth < t.scrollWidth - 4); };
  });
}
new MutationObserver(updateRails).observe($view, { childList: true });
window.addEventListener('resize', updateRails);
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('.rail-btn');
  if (b) { const t = b.parentElement.querySelector('.rail-track'); t.scrollBy({ left: (b.classList.contains('next') ? 1 : -1) * t.clientWidth * 0.8 }); return; }
  const x = ev.target.closest('.detail .close');
  if (x) { x.closest('.detail').remove(); document.querySelectorAll('.tile.sel[data-detail]').forEach((t) => t.classList.remove('sel')); return; }
  const d = ev.target.closest('.tile[data-detail]');
  if (!d || !HOME_DETAIL[d.dataset.detail]) return;
  ev.preventDefault();
  document.querySelectorAll('.rail-detail').forEach((el) => { el.innerHTML = ''; });
  const was = d.classList.contains('sel');
  document.querySelectorAll('.tile.sel[data-detail]').forEach((t) => t.classList.remove('sel'));
  if (was) return;
  d.classList.add('sel');
  const box = d.closest('.rail').querySelector('.rail-detail');
  box.innerHTML = `<div class="detail"><button class="close" aria-label="Close">&times;</button>${HOME_DETAIL[d.dataset.detail]}</div>`;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

/* ---------------- Home ---------------- */
let HOME_DETAIL = {};
const PHASE_ICON = { ingest: '⇢', normalise: '≡', review: '✎', delta: 'Δ', 'merge-approval': '⊕' };
const PHASE_CAT = { ingest: 'intake', normalise: 'intake', review: 'gate', delta: 'intake', 'merge-approval': 'gate', requirements: 'design', rules: 'design', testcases: 'design', scripts: 'design', execution: 'run', defects: 'run', report: 'run' };
const agentNo = (id) => (META.platform.agents.find((g) => g.id === id) || {}).no;

const EXEC_INPUT = {
  'jira-initiative': ['Jira initiative', 'The business goal and scope.', 'Defines what the capability must achieve.'],
  'jira-epic': ['Jira epics and stories', 'The detailed requirements and acceptance criteria.', 'Tells the platform exactly what must be tested.'],
  codebase: ['Application code', 'How the system actually behaves today.', 'Shows what was really built, so gaps and mismatches surface early.'],
  'data-model': ['Data model', 'The information a record holds and its allowed values.', 'Supplies realistic test data.'],
  confluence: ['Business documents', 'Requirement documents and Confluence pages.', 'Adds rules and examples not captured in Jira.'],
  'api-contract': ['API specifications', 'How the systems talk to each other.', 'Drives tests of the services behind the screens.'],
  'existing-tests': ['Existing test suites', 'Tests the team already has.', 'Reused rather than rewritten, and shows where coverage is missing.'],
  'defect-history': ['Defect history', 'Past defects and production incidents.', 'Focuses testing where things have broken before.'],
  'ui-design': ['UI designs', 'Screen designs for the user journeys.', 'Drives tests of what the user sees and does.'],
  regulatory: ['Policies and regulations', 'Rules the business must comply with.', 'Makes sure mandatory rules are tested and reported.'],
};
const EXEC_AGENT = {
  requirements: ['Combines every input into one agreed list of requirements.', 'Everyone tests against the same approved scope.'],
  rules: ['Pulls out the business rules and the exact values behind them.', 'Every rule can be traced back to where it was stated.'],
  testcases: ['Writes the test cases, ready for the test management tool.', 'Consistent, reviewable coverage in hours rather than weeks.'],
  scripts: ['Turns the test cases into automated tests.', 'The same tests can be re-run on every release.'],
  execution: ['Runs the automated tests for real.', 'Results are actual, not estimated.'],
  defects: ['Logs a defect only when a test really fails.', 'No noise: every defect comes with evidence.'],
  report: ['Produces the quality report and compares cycles.', 'One clear view of quality for decision makers.'],
};
const FLOW_BRIEF = {
  baseline: ['Baseline', 'The first full quality check of a capability.', [
    'Bring the project\'s inputs.',
    'The platform combines them into one list of requirements and highlights any disagreements.',
    'A person resolves the disagreements and approves the list.',
    'The agents design the tests, automate them, run them and log real defects.',
    'A report shows what was tested, what passed and what failed.',
    'The approved result is saved as the baseline for future releases.'], '#/run?type=baseline', 'Start a baseline'],
  incremental: ['Incremental', 'A quick update when something changes, without starting again.', [
    'Pick the approved baseline and bring only what changed.',
    'The platform shows what is unchanged, what changed and what is new.',
    'Only the changes are redesigned; everything else is reused.',
    'A person approves before the baseline is updated.',
    'All tests run again, and a report compares this cycle with the last one.'], '#/run?type=incremental', 'Start an incremental update'],
};

async function viewHome() {
  setTitle();
  const P = META.platform;
  HOME_DETAIL = {};
  const inName = (t) => (EXEC_INPUT[t.id] || [t.name])[0];
  const inputTiles = P.inputTypes.map((t) => {
    const [name, what, use] = EXEC_INPUT[t.id] || [t.name, t.about, t.reads];
    const by = P.agents.filter((g) => (t.usedBy || []).includes(g.id)).map((g) => g.name);
    HOME_DETAIL[`input-${t.id}`] = `<h2>${esc(name)}</h2><ul class="brief"><li><b>What it is:</b> ${esc(what)}</li><li><b>Why it matters:</b> ${esc(use)}</li><li><b>Used by:</b> ${esc(by.join(', '))}</li></ul>`;
    return tile({ detail: `input-${t.id}`, art: 'input', tag: 'Input', big: '⇢', title: name, lines: [esc(what)] });
  });
  const agentTiles = P.agents.map((g) => {
    const [does, value] = EXEC_AGENT[g.id] || [g.produces, ''];
    const from = P.inputTypes.filter((t) => (t.usedBy || []).includes(g.id)).map(inName);
    HOME_DETAIL[`agent-${g.id}`] = `<h2>${esc(g.name)}</h2><ul class="brief"><li><b>What it does:</b> ${esc(does)}</li><li><b>Why it matters:</b> ${esc(value)}</li><li><b>Works from:</b> ${esc([...from, ...(g.no > 1 ? ['the output of the agent before it'] : [])].join(', '))}</li></ul>`;
    return tile({ detail: `agent-${g.id}`, art: g.no <= 4 ? 'design' : 'run', tag: `Agent ${g.no}`, big: g.no, title: g.name, lines: [esc(does)] });
  });
  const flowTiles = Object.entries(FLOW_BRIEF).map(([id, [name, intro, points, href, cta]], i) => {
    HOME_DETAIL[`flow-${id}`] = `<h2>${esc(name)}</h2><p>${esc(intro)}</p><ul class="brief">${points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><a class="btn" href="${href}">${esc(cta)}</a>`;
    return tile({ detail: `flow-${id}`, art: i ? 'flow2' : 'flow1', tag: 'Flow', big: i + 1, title: name, lines: [esc(intro)] });
  });
  $view.innerHTML = `<section class="hero"><div class="eyebrow">Agentic QE Platform</div><h1>Quality engineering run by seven AI agents, with people in control.</h1>
<p>Bring what your project already has: Jira, code and documents. The platform turns it into tested, reported quality, and keeps every approved result as a baseline for the next release.</p>
<div class="facts"><div><b>${P.inputTypes.length}</b>kinds of input</div><div><b>${P.agents.length}</b>AI agents</div><div><b>2</b>ways to run</div><div><b>100%</b>of changes approved by a person</div></div></section>
${rail('inputs', 'What goes in', 'click an input for details', inputTiles)}
${rail('agents', 'Who does the work', 'click an agent for details', agentTiles)}
${rail('flows', 'How it runs', 'click a flow for a short brief', flowTiles)}`;
}

function cycleTile(c) {
  const ex = c.summary;
  return tile({ href: `#/cycle/${c.id}`, art: c.type === 'baseline' ? 'flow1' : 'flow2', tag: c.type === 'baseline' ? 'Flow 1' : 'Flow 2', big: c.id.replace('CYC-', '#'), corner: `<span class="status-dot ${esc(c.status)}"></span>${esc(c.status)}`, title: c.name,
    lines: [c.delta ? esc(c.delta) : `baseline ${esc(c.baselineId || '(on completion)')}`, ex ? `${ex.passed}/${ex.executed} passed · ${ex.passRate}%` : '<span class="muted">not executed yet</span>'], progress: ex ? ex.passRate : 0 });
}

/* ---------------- Run ---------------- */
async function viewRun(params) {
  setTitle('Run');
  if (params.get('type')) runState.type = params.get('type');
  const baselines = await api('/api/baselines');
  if (runState.type === 'incremental' && !runState.baselineId && baselines.length) runState.baselineId = baselines[baselines.length - 1].id;
  const s = META.samples;
  const slots = runState.type === 'baseline'
    ? [['initiative', 'Jira initiative', s.initiative], ['epic', 'Jira epic', s.epic], ['codebase', 'Codebase', s.baselineBranch]]
    : [['epic', 'New Jira epic', s.incrementalEpic], ['codebase', 'Updated codebase', s.incrementalBranch]];
  for (const [slot, , def] of slots) {
    const cur = runState.inputs[slot];
    if (!cur || cur.forType !== runState.type) runState.inputs[slot] = slot === 'codebase' ? { forType: runState.type, mode: 'github', branch: def, text: '' } : { forType: runState.type, mode: META.jira.mode === 'live' ? 'jira' : 'github', key: def, text: '' };
  }
  const slotCard = ([slot, label]) => {
    const st = runState.inputs[slot];
    const isCode = slot === 'codebase';
    const modes = isCode ? [['github', `Pull branch from GitHub (${META.codebase.repo})`], ['sample', 'Recorded snapshot of the branch (offline)'], ['paste', 'Paste README / source notes']]
      : [['github', `Pull the Jira REST v3 export from GitHub (${META.jiraExport.branch})`], ['jira', META.jira.mode === 'live' ? 'Jira issue key (live Jira call)' : 'Jira issue key (recorded fixture, offline)'], ['paste', 'Paste issue JSON or one statement per line']];
    return `<div class="card"><h3>${esc(label)}</h3>
<div class="row">${modes.map(([m, t]) => `<label><input type="radio" name="mode-${slot}" value="${m}" ${st.mode === m ? 'checked' : ''} data-slot="${slot}" class="mode"> ${esc(t)}</label>`).join('<br>')}</div>
<div style="margin-top:8px">${st.mode === 'paste'
    ? `<textarea data-slot="${slot}" class="paste" placeholder="Paste here">${esc(st.text)}</textarea><button class="btn secondary sample" data-slot="${slot}">Fill with sample content</button> ${pill('pasted', 'pasted')}`
    : isCode ? `<select data-slot="${slot}" class="branch">${META.codebase.branches.map((b) => `<option ${b === st.branch ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select> <span class="muted small">${esc(META.codebase.repo)}</span> ${st.mode === 'github' ? pill('pulled live from GitHub', 'github') : pill('recorded fixture', 'fixture')}`
      : `<input type="text" data-slot="${slot}" class="key" value="${esc(st.key)}"> ${st.mode === 'github' ? pill('pulled live from GitHub', 'github') : META.jira.mode === 'live' ? pill('live Jira call', 'live') : pill('recorded fixture', 'fixture')}`}</div></div>`;
  };
  $view.innerHTML = `<h1>Run a cycle</h1>

<div class="card"><h3>1. What do you want to do?</h3><div class="row">
<div class="choice ${runState.type === 'baseline' ? 'selected' : ''}" data-type="baseline"><b>New baseline</b><br><span class="muted">Jira initiative + Jira epic + codebase</span></div>
<div class="choice ${runState.type === 'incremental' ? 'selected' : ''}" data-type="incremental"><b>Add to a baseline</b><br><span class="muted">One new Jira epic + updated codebase, against an approved baseline</span></div></div></div>
${runState.type === 'incremental' ? `<div class="card"><h3>2. Pick the baseline</h3>${baselines.length
    ? `<select id="baseline">${baselines.map((b) => `<option value="${esc(b.id)}" ${b.id === runState.baselineId ? 'selected' : ''}>${esc(b.id)} v${b.version} - ${esc(b.name)} (${b.counts.requirements} requirements, ${b.counts.testCases} test cases)</option>`).join('')}</select> <span class="muted small">The baseline is selected, not re-uploaded.</span>`
    : '<div class="banner">No approved baseline yet. Run a new baseline first.</div>'}</div>` : ''}
<h2>${runState.type === 'incremental' ? '3' : '2'}. Inputs</h2><div class="grid${slots.length}">${slots.map(slotCard).join('')}</div>
<h2>${runState.type === 'incremental' ? '4' : '3'}. Skills for this run</h2>${skillsCard()}
<div class="card"><div class="row"><label>Your name (recorded on approvals) <input type="text" id="who" value="${esc(localStorage.getItem('aqe-user') || '')}" placeholder="e.g. Priya Shah"></label>
<button class="btn" id="go" ${runState.type === 'incremental' && !baselines.length ? 'disabled' : ''}>Run: ingest &amp; normalise</button></div>
<p class="muted small">The run ingests the inputs and normalises them, then pauses on the human review screen. Nothing is designed until you approve.</p><div id="run-msg"></div></div>`;

  $view.querySelectorAll('.choice').forEach((el) => el.onclick = () => { runState.type = el.dataset.type; location.hash = `#/run?type=${runState.type}`; });
  $view.querySelectorAll('.mode').forEach((el) => el.onchange = () => { runState.inputs[el.dataset.slot].mode = el.value; viewRun(new URLSearchParams()); });
  $view.querySelectorAll('.key').forEach((el) => el.oninput = () => { runState.inputs[el.dataset.slot].key = el.value.trim(); });
  $view.querySelectorAll('.branch').forEach((el) => el.onchange = () => { runState.inputs[el.dataset.slot].branch = el.value; });
  $view.querySelectorAll('.paste').forEach((el) => el.oninput = () => { runState.inputs[el.dataset.slot].text = el.value; });
  $view.querySelectorAll('.sample').forEach((el) => el.onclick = async () => {
    const slot = el.dataset.slot;
    const def = slots.find((x) => x[0] === slot)[2];
    const q = slot === 'codebase' ? `slot=codebase&branch=${encodeURIComponent(def)}` : `slot=${slot}&key=${def}`;
    runState.inputs[slot].text = await api(`/api/sample-text?${q}`);
    viewRun(new URLSearchParams());
  });
  $view.querySelectorAll('.skill-on').forEach((el) => el.onchange = () => {
    runState.skills = [...$view.querySelectorAll('.skill-on')].filter((x) => x.checked).map((x) => x.value);
    document.getElementById('skill-count').textContent = `${runState.skills.length} of ${META.skills.length} selected`;
  });
  const sel = document.getElementById('baseline');
  if (sel) sel.onchange = () => { runState.baselineId = sel.value; };
  document.getElementById('go').onclick = async (ev) => {
    const who = document.getElementById('who').value.trim();
    localStorage.setItem('aqe-user', who);
    const inputs = {};
    for (const [slot] of slots) { const { forType, ...rest } = runState.inputs[slot]; inputs[slot] = rest; }
    ev.target.disabled = true;
    document.getElementById('run-msg').innerHTML = '<div class="banner info">Ingesting and normalising...</div>';
    try {
      const c = await api('/api/cycles', { method: 'POST', body: { type: runState.type, baselineId: runState.baselineId, inputs, reviewer: who, skills: selectedSkills() } });
      location.hash = `#/cycle/${c.id}`;
    } catch (e) {
      document.getElementById('run-msg').innerHTML = `<div class="banner err">${esc(e.message)}</div>`;
      ev.target.disabled = false;
    }
  };
}

/* ---------------- Cycles ---------------- */
async function viewCycles() {
  setTitle('Cycles');
  const cycles = (await api('/api/cycles')).slice().reverse();
  const base = cycles.filter((c) => c.type === 'baseline').map(cycleTile);
  const inc = cycles.filter((c) => c.type === 'incremental').map(cycleTile);
  $view.innerHTML = `<section class="hero small-hero"><div class="eyebrow">Cycles</div><h1>Every run, by flow</h1><p>Open a cycle to browse its phases: intake and review, the design agents, then execution, defects and the report.</p><a class="btn" href="#/run">&#9654; Run a new cycle</a></section>
${cycles.length ? '' : '<p class="muted">No cycles yet.</p>'}${base.length ? rail('base', 'Flow 1 · Baseline cycles', '', base) : ''}${inc.length ? rail('inc', 'Flow 2 · Incremental cycles', '', inc) : ''}`;
}
const statusPill = (s) => pill(s, { completed: 'passed', failed: 'failed', rejected: 'failed', 'awaiting-review': 'designed', 'awaiting-merge': 'designed', running: 'enhanced', interrupted: 'failed' }[s] || 'pending');

function phaseArtifactTab(name, c) {
  return { ingest: 'inputs', normalise: 'normalise', review: c.status === 'awaiting-review' ? 'review' : 'normalise', delta: 'delta', requirements: 'requirements', rules: 'rules', testcases: 'testcases', scripts: 'scripts', 'merge-approval': 'merge', execution: 'execution', defects: 'defects', report: 'report' }[name];
}

const PHASE_GROUPS = [
  ['intake', 'Intake and review', 'deterministic code and the human gate', ['ingest', 'normalise', 'review', 'delta']],
  ['design', 'Design agents 1-4', 'requirements, rules, test cases, scripts', ['requirements', 'rules', 'testcases', 'scripts', 'merge-approval']],
  ['run', 'Run and results · agents 5-7', 'real execution, defects from real failures, report', ['execution', 'defects', 'report']],
];
const PHASE_PROGRESS = { done: 100, running: 50, waiting: 50, failed: 100, pending: 0, skipped: 0 };

function phaseTile(c, p, tab) {
  const t = phaseArtifactTab(p.name, c);
  const no = agentNo(p.name);
  const cat = PHASE_CAT[p.name];
  return tile({ href: `#/cycle/${c.id}?tab=${t}`, art: cat, tag: no ? `Agent ${no}` : cat === 'gate' ? 'Human gate' : 'Intake', big: no || PHASE_ICON[p.name] || '•',
    corner: `<span class="status-dot ${esc(p.status)}"></span>${esc(p.status)}`, title: p.label, lines: [p.summary ? esc(p.summary) : '<span class="muted">not run yet</span>'], extra: handoverBadge(p),
    cls: `${p.status} ${t === tab && (p.name !== 'review' || tab === 'review') ? 'sel' : ''}`, progress: PHASE_PROGRESS[p.status] ?? 0 });
}

async function viewCycle(id, params) {
  const c = await api(`/api/cycles/${id}`);
  setTitle(c.name);
  const tab = params.get('tab') || (c.status === 'awaiting-review' ? 'review' : c.status === 'awaiting-merge' ? 'merge' : c.status === 'completed' ? 'report' : 'inputs');
  const present = new Set(c.phases.map((p) => p.name));
  const rails = PHASE_GROUPS.map(([gid, title, note, names]) => {
    const tiles = names.filter((n) => present.has(n)).map((n) => phaseTile(c, c.phases.find((p) => p.name === n), tab));
    if (gid === 'run') tiles.push(tile({ href: `#/cycle/${c.id}?tab=skills`, art: 'skill', tag: 'Skills', big: (c.skills || []).length, title: 'Skills and hand-overs', lines: ['Which skills each agent read and what it handed over'], cls: tab === 'skills' ? 'sel' : '' }));
    return rail(gid, title, note, tiles);
  }).join('');
  const done = c.phases.filter((p) => p.status === 'done').length;
  const ex = c.artifacts && c.artifacts.execution ? c.artifacts.execution.summary : null;
  const current = c.phases.find((p) => phaseArtifactTab(p.name, c) === tab);
  const label = tab === 'skills' ? 'Skills and hand-overs' : tab === 'merge' ? 'Human approval to merge' : tab === 'review' ? 'Human review of requirement set' : current ? current.label : tab;
  let body = '';
  try { body = await renderCycleTab(c, tab); } catch (e) { body = `<div class="banner err">${esc(e.message)}</div>`; }
  $view.innerHTML = `<section class="hero small-hero"><div class="eyebrow">${c.type === 'baseline' ? 'Flow 1 · Baseline cycle' : 'Flow 2 · Incremental cycle'}</div>
<h1>${esc(c.name)} <span class="muted small">${esc(c.id)}</span> ${statusPill(c.status)}</h1>
<div class="facts"><div><b>${done}/${c.phases.length}</b>phases done</div>${c.delta ? `<div><b>${esc(c.delta.summary)}</b>delta</div>` : ''}${ex ? `<div><b>${ex.passed}/${ex.executed}</b>passed</div><div><b>${ex.passRate}%</b>pass rate</div>` : ''}${c.artifacts && c.artifacts.defects ? `<div><b>${c.artifacts.defects.length}</b>defects</div>` : ''}</div>
<div class="muted small">Baseline: ${esc(c.baselineId || '(created when this cycle completes)')}${c.baselineVersionAtStart ? ` v${c.baselineVersionAtStart} at start` : ''}${c.baselineVersionAfter ? ` → v${c.baselineVersionAfter}` : ''} · SUT build <code>${esc(c.sutBuild)}</code> · created ${fmtTime(c.createdAt)}</div></section>
${c.error ? `<div class="banner err">Failed: ${esc(c.error)} <button class="btn secondary" id="resume">Resume</button></div>` : ''}
${c.status === 'interrupted' ? `<div class="banner">This cycle was interrupted by a restart. <button class="btn secondary" id="resume">Resume</button></div>` : ''}
${c.status === 'running' ? '<div class="banner info">Agents are running... this page refreshes automatically.</div>' : ''}
${rails}
<section class="panel" id="detail-panel"><div class="panel-head"><h2>${esc(label)}</h2><span class="crumbs"><a href="#/cycles">Cycles</a> › <a href="#/cycle/${esc(c.id)}">${esc(c.id)}</a> › ${esc(label)}</span></div><div id="tab">${body}</div></section>`;
  const r = document.getElementById('resume');
  if (r) r.onclick = async () => { await api(`/api/cycles/${c.id}/resume`, { method: 'POST' }); route(); };
  bindCycleTab(c, tab);
  const sel = $view.querySelector('.tile.sel');
  if (sel) sel.parentElement.scrollLeft = Math.max(0, sel.offsetLeft - sel.parentElement.offsetLeft - 40);
  if (params.get('tab') && c.status !== 'running') document.getElementById('detail-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (c.status === 'running') pollTimer = setTimeout(route, 1500);
}

function inputsTable(c) {
  return table(['Input', 'Reference', 'Statements', 'Provenance', 'Files / detail'], c.inputs.map((i) => [esc(i.label), `${esc(i.ref)}${i.summary ? `<br><span class="muted">${esc(i.summary)}</span>` : ''}${i.children && i.children.length ? `<br><span class="muted small">child issues: ${esc(i.children.join(', '))}</span>` : ''}`,
    `${i.statementCount}${i.dataModel ? `<br><span class="small muted">data model: ${esc(i.dataModel.attributeCount)} attributes, ${esc(i.dataModel.drivers.length)} commission drivers</span>` : ''}`, `${provPill(i.provenance)}<br><span class="small">${esc(i.provenance.label)}</span>`, `<span class="small">${esc((i.provenance.files || []).join(', '))}</span>${i.compare ? `<br><span class="small">compare vs ${esc(i.compare.baseBranch || (i.compare.base ? i.compare.base.slice(0, 7) : 'base'))} (${esc(i.compare.status)}): ${esc(i.compare.files.map((f) => `${f.filename} (${f.status})`).join(', '))}</span>` : ''}`]));
}

const originCell = (origins) => origins.map((o) => `<div class="quote">"${esc(o.quote)}"</div><div class="small muted">${pill(o.source, o.source === 'jira' ? 'jira-only' : 'code-only')} <a href="${esc(o.url || '#')}" target="_blank" rel="noopener">${esc(o.ref)}${o.line ? `:${o.line}` : ''}</a></div>`).join('');

function groupOrigins(c, g) {
  const byId = new Map(c.normalisation.statements.map((s) => [s.id, s]));
  return g.members.map((m) => byId.get(m)).filter(Boolean).map((s) => ({ quote: s.quote, source: s.source, ref: s.origin.ref, line: s.origin.line, url: s.origin.url }));
}

function normaliseView(c, interactive) {
  const n = c.normalisation;
  const decisions = c.review || { excluded: [], resolutions: {} };
  const byBucket = (b) => n.groups.filter((g) => g.bucket === b);
  const excl = (g) => interactive ? `<label class="small"><input type="checkbox" class="excl" data-g="${esc(g.id)}"> exclude</label>` : (decisions.excluded.includes(g.id) ? pill('excluded', 'failed') : '');
  const simple = (b) => table(['Group', 'Statement', 'Sources and quotes', ''], byBucket(b).map((g) => [esc(g.id), esc(g.text), originCell(groupOrigins(c, g)), excl(g)]));
  const conflicts = byBucket('conflict');
  return `<div class="kpis"><div class="kpi">Statements<b>${n.counts.statements}</b></div><div class="kpi">Agreed<b>${n.counts.agreed}</b></div><div class="kpi">Only Jira<b>${n.counts['jira-only']}</b></div><div class="kpi">Only code<b>${n.counts['code-only']}</b></div><div class="kpi">Conflicts<b>${n.counts.conflict}</b></div></div>
<p class="muted small">Computed in code: statements are grouped by subject (token similarity) and compared on extracted values (%, days, hours, ms, HTTP status...). Nothing here was decided by a model.</p>
<h2>Conflicting values ${pill(`${conflicts.length}`, 'conflict')}</h2>${conflicts.length ? conflicts.map((g) => `<div class="card"><b>${esc(g.id)}</b> - subject: <i>${esc(g.subject)}</i>
${table(['Choose', 'Value', 'Statement', 'Source'], g.options.map((o) => [interactive ? `<input type="radio" name="res-${esc(g.id)}" value="${esc(o.optionId)}" class="res" data-g="${esc(g.id)}">` : (decisions.resolutions[g.id] === o.optionId ? pill('chosen', 'passed') : ''),
    `<b>${esc(o.signature)}</b>`, esc(o.text), o.sources.map((s) => pill(s, s === 'jira' ? 'jira-only' : 'code-only')).join(' ')]))}
${interactive ? `<label class="small"><input type="radio" name="res-${esc(g.id)}" value="__exclude" class="res" data-g="${esc(g.id)}"> exclude this requirement</label> <span class="pill conflict res-state" data-g="${esc(g.id)}">unresolved</span>` : (decisions.excluded.includes(g.id) ? pill('excluded', 'failed') : '')}</div>`).join('') : '<p class="muted">No conflicting values.</p>'}
<h2>Only Jira has ${pill(byBucket('jira-only').length, 'jira-only')}</h2>${simple('jira-only')}
<h2>Only the code has ${pill(byBucket('code-only').length, 'code-only')}</h2>${simple('code-only')}
<h2>Agreed by Jira and code ${pill(byBucket('agreed').length, 'agreed')}</h2>${simple('agreed')}`;
}

function deltaView(d, { title = 'Delta against the baseline' } = {}) {
  if (!d) return '<p class="muted">No delta yet.</p>';
  return `<h2>${esc(title)}</h2><div class="split" id="split">${esc(d.summary)}</div>
${d.pendingConflicts && d.pendingConflicts.length ? `<div class="banner">${d.pendingConflicts.length} conflict(s) still unresolved are not counted yet.</div>` : ''}
<p class="muted small">Computed in code against the baseline requirements: same subject &amp; same values = unchanged; same subject, different value = enhanced (new value wins, old kept); no matching subject = new.</p>
${table(['Class', 'Incoming statement', 'Baseline requirement', 'Superseded / matched value', 'Similarity'], d.items.map((it) => [artPill(it.classification), esc(it.incoming.text), esc(it.baselineRequirementId || '-'),
    it.classification === 'enhanced' ? `<span class="old">${esc(it.previous.text)}</span>` : it.matched ? `<span class="muted">${esc(it.matched.text)}</span>` : it.previous ? `<span class="muted">${esc(it.previous.text)}</span>` : '<span class="muted small">no baseline match</span>', it.similarity]), (i) => `row-${d.items[i].classification}`)}`;
}

async function renderCycleTab(c, tab) {
  const a = c.artifacts || {};
  const notYet = (what) => `<div class="banner info">${esc(what)} not produced yet (${esc(c.status)}).</div>`;
  switch (tab) {
    case 'inputs': return `<h2>Inputs and provenance</h2>${inputsTable(c)}`;
    case 'normalise': return `${c.review ? `<div class="banner ok">Reviewed by ${esc(c.review.reviewer)} at ${fmtTime(c.review.at)}. The reviewed set - not the raw inputs - flowed on.</div>` : ''}${normaliseView(c, false)}`;
    case 'review': {
      if (c.status !== 'awaiting-review') return `<div class="banner ok">Review complete.</div>${normaliseView(c, false)}`;
      return `<div class="banner info">Human review: settle every conflicting value (choose a value or exclude it), optionally exclude any statement, then approve the requirement set. Only the approved set flows on.</div>
${c.type === 'incremental' ? `<div class="card" id="delta-box">${deltaView(c.deltaPreview, { title: 'Delta preview (before anything is designed)' })}</div>` : ''}
${normaliseView(c, true)}
<div class="card"><div class="row"><label>Reviewer <input type="text" id="reviewer" value="${esc(localStorage.getItem('aqe-user') || c.createdBy || '')}"></label>
<label>Comment <input type="text" id="comment" size="40"></label>
<button class="btn good" id="approve-review">Approve requirement set</button><span id="review-msg" class="small"></span></div></div>`;
    }
    case 'delta': return c.delta ? deltaView(c.delta) : deltaView(c.deltaPreview, { title: 'Delta preview (not yet reviewed)' });
    case 'requirements': return a.requirements ? requirementsView(c) : notYet('Requirements');
    case 'rules': return a.rules ? rulesView(c) : notYet('Business rules');
    case 'testcases': return a.testCases ? testCasesView(c) : notYet('Test cases');
    case 'scripts': return a.scripts ? scriptsView(c) : notYet('Scripts');
    case 'merge': return mergeView(c);
    case 'execution': return a.execution ? executionView(c) : `${notYet('Execution')}<p class="muted">Scripts are <b>designed</b> but have not been executed.</p>`;
    case 'defects': return a.defects ? defectsView(c) : notYet('Defects');
    case 'report': return c.report ? reportView(c) : notYet('Cycle report');
    case 'skills': return skillsView(c);
    default: return '';
  }
}

function bindCycleTab(c, tab) {
  if (tab !== 'review' || c.status !== 'awaiting-review') return;
  const conflicts = c.normalisation.groups.filter((g) => g.bucket === 'conflict');
  const collect = () => {
    const excluded = [...$view.querySelectorAll('.excl:checked')].map((e) => e.dataset.g);
    const resolutions = {};
    for (const g of conflicts) {
      const v = $view.querySelector(`input[name="res-${g.id}"]:checked`);
      if (v && v.value === '__exclude') excluded.push(g.id);
      else if (v) resolutions[g.id] = v.value;
    }
    return { excluded, resolutions };
  };
  const btn = document.getElementById('approve-review');
  const refresh = async () => {
    const d = collect();
    const open = conflicts.filter((g) => !d.resolutions[g.id] && !d.excluded.includes(g.id));
    $view.querySelectorAll('.res-state').forEach((el) => { const ok = !open.some((g) => g.id === el.dataset.g); el.textContent = ok ? 'settled' : 'unresolved'; el.className = `pill ${ok ? 'passed' : 'conflict'} res-state`; });
    btn.disabled = open.length > 0;
    document.getElementById('review-msg').textContent = open.length ? `${open.length} conflict(s) still need a decision` : '';
    if (c.type === 'incremental') {
      const p = await api(`/api/cycles/${c.id}/delta-preview`, { method: 'POST', body: d });
      document.getElementById('delta-box').innerHTML = deltaView(p, { title: 'Delta preview (before anything is designed)' });
    }
  };
  $view.querySelectorAll('.excl,.res').forEach((el) => el.onchange = refresh);
  refresh();
  btn.onclick = async () => {
    const reviewer = document.getElementById('reviewer').value.trim();
    if (!reviewer) { document.getElementById('review-msg').textContent = 'Enter the reviewer name'; return; }
    localStorage.setItem('aqe-user', reviewer);
    btn.disabled = true;
    try {
      await api(`/api/cycles/${c.id}/review`, { method: 'POST', body: { reviewer, comment: document.getElementById('comment').value, ...collect() } });
      location.hash = `#/cycle/${c.id}?tab=${c.type === 'incremental' ? 'delta' : 'requirements'}`;
    } catch (e) { document.getElementById('review-msg').textContent = e.message; btn.disabled = false; }
  };
}

function requirementsView(c) {
  const reqs = c.artifacts.requirements;
  return `<h2>Requirements repository (${reqs.length})</h2>${table(['ID', 'Requirement', 'Type', 'Status', 'Superseded value', 'Sources and quotes', 'Jira'], reqs.map((r) => [esc(r.id), esc(r.text), esc(r.type), artPill(r.status || 'new'),
    r.previous ? `<span class="old">${esc(r.previous.text)}</span> <span class="small muted">v${r.previous.version}</span>` : '', originCell(r.origins), esc((r.jiraKeys || []).join(', '))]), (i) => `row-${reqs[i].status}`)}`;
}

function rulesView(c) {
  const rules = c.artifacts.rules;
  return `<h2>Business rules (${rules.length})</h2>${table(['ID', 'Req', 'Rule', 'Parameters', 'Status', 'Source quotes'], rules.map((r) => [esc(r.id), esc(r.requirementId), `<b>${esc(r.title)}</b><br>${esc(r.statement)}${r.previous ? `<br><span class="old">${esc(r.previous.statement)}</span>` : ''}`,
    `<code>${esc(JSON.stringify(r.parameters))}</code>${r.executable ? '' : '<br><span class="muted small">no executable check</span>'}`, artPill(r.status), r.quotes.map((q) => `<div class="quote">"${esc(q.text)}"</div><div class="small"><a href="${esc(q.url || '#')}" target="_blank" rel="noopener">${esc(q.ref)}${q.line ? `:${q.line}` : ''}</a> (${esc(q.source)})</div>`).join('')]), (i) => `row-${rules[i].status}`)}`;
}

function testCasesView(c) {
  const tcs = c.artifacts.testCases;
  const cnt = (f) => tcs.reduce((m, t) => { for (const k of [].concat(f(t))) m[k] = (m[k] || 0) + 1; return m; }, {});
  const kv = (o) => Object.entries(o).map(([k, v]) => `${esc(k)}: <b>${v}</b>`).join(' · ');
  return `<div class="row"><h2 style="margin:0">Test cases (${tcs.length})</h2><a class="btn" href="/api/cycles/${esc(c.id)}/export/testcases.xlsx">Download Excel (.xlsx, Zephyr Scale columns)</a></div>
<p class="small">By type: ${kv(cnt((t) => t.type))} · by label: ${kv(cnt((t) => t.labels))} · ${kv(cnt((t) => t.automation))}${c.type === 'incremental' ? ` · ${kv(cnt((t) => t.status))}` : ''}</p>
<p class="muted small">These are <b>designed</b> test cases. Execution results are on the Execution tab.${c.type === 'incremental' ? ' In the Excel export, new rows are green, changed rows amber (superseded expected result in a cell note).' : ''}</p>
${table(['Key', 'Name / objective', 'Precondition', 'Steps', 'Test data', 'Expected result', 'Priority', 'Type', 'Labels', 'Links', 'Automation', 'Status'], tcs.map((t) => [esc(t.key),
    `<b>${esc(t.name)}</b>${t.previous && t.previous.name !== t.name ? `<br><span class="old">${esc(t.previous.name)}</span>` : ''}<br><span class="small muted">${esc(t.objective)}</span>`, esc(t.precondition),
    `<ol style="margin:0;padding-left:16px">${t.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`, `<code>${esc(t.testData)}</code>`,
    `${t.previous && t.previous.expected !== t.expected ? `<span class="old">${esc(t.previous.expected)}</span><br>` : ''}<span class="${t.previous ? 'newv' : ''}">${esc(t.expected)}</span>`, esc(t.priority), esc(t.type), esc(t.labels.join(', ')),
    esc([...(t.issueLinks || []), t.requirementId].join(', ')), t.scriptFile ? `${esc(t.automation)}<br><a class="small" href="#/scripts?cycle=${esc(c.id)}&file=${esc(t.scriptFile)}">${esc(t.scriptFile)}</a>` : esc(t.automation), artPill(t.status)]), (i) => `row-${tcs[i].status}`)}`;
}

function codeBlock(code, highlight = []) {
  return `<pre class="code">${code.split('\n').map((l) => (highlight.includes(l) ? `<span class="hl">${esc(l)}</span>` : esc(l))).join('\n')}</pre>`;
}
function changedLines(code, prev) {
  if (!prev) return [];
  const old = new Set(prev.split('\n'));
  return code.split('\n').filter((l) => l.trim() && !old.has(l));
}

function scriptsView(c, params = new URLSearchParams()) {
  const scripts = c.artifacts.scripts;
  const file = params.get('file');
  return `<h2>Playwright scripts (${scripts.length})</h2><p class="muted small">Generated, self-contained specs against the bundled sample service. ${c.artifacts.execution ? 'These specs were <b>executed</b> by the Playwright CLI in this cycle.' : 'Designed, not yet executed.'}</p>
${scripts.map((s) => `<details class="card" ${!file || file === s.file ? 'open' : ''} id="s-${esc(s.file)}"><summary><b>${esc(s.file)}</b> · covers ${esc(s.covers.join(', '))} · ${esc(s.requirementId)} · v${s.version} ${artPill(s.status)}
<a class="small" href="/api/cycles/${esc(c.id)}/scripts/${encodeURIComponent(s.file)}?download=1">download</a></summary>
${s.previous ? `<p class="small">Re-designed from v${s.previous.version}; changed lines highlighted.</p><div class="grid2"><div><b class="small">Superseded (v${s.previous.version})</b>${codeBlock(s.previous.code, changedLines(s.previous.code, s.code))}</div><div><b class="small">New (v${s.version})</b>${codeBlock(s.code, changedLines(s.code, s.previous.code))}</div></div>` : codeBlock(s.code)}</details>`).join('')}`;
}

function mergeView(c) {
  if (c.type !== 'incremental') return '<p class="muted">Baseline cycles have no merge step.</p>';
  if (!c.mergeProposal) return '<div class="banner info">The merge review appears once the delta has been designed.</div>';
  const a = c.artifacts;
  const mp = c.mergeProposal;
  const reqs = a.requirements.filter((r) => mp.requirements.includes(r.id));
  const tcs = a.testCases.filter((t) => mp.testCases.includes(t.key));
  const scripts = a.scripts.filter((s) => mp.scripts.includes(s.file));
  const decided = c.approvals.find((p) => p.gate === 'Merge into baseline');
  const counts = (arr) => `${arr.filter((x) => x.status === 'new').length} new · ${arr.filter((x) => x.status !== 'new').length} re-designed`;
  return `${decided ? `<div class="banner ${decided.decision === 'approved' ? 'ok' : 'err'}">Merge ${esc(decided.decision)} by ${esc(decided.by)} at ${fmtTime(decided.at)}. ${esc(decided.detail)}</div>`
    : `<div class="banner info">Nothing joins baseline ${esc(mp.baselineId)} v${mp.baselineVersion} until you approve. Rejecting leaves it untouched. ${a.requirements.length - reqs.length} unchanged requirements and their artifacts are carried over and not listed.</div>`}
${c.rejectedRows && c.rejectedRows.length ? `<div class="banner">Rows rejected at the gate (kept at baseline value / not added): ${esc(c.rejectedRows.join(', '))}</div>` : ''}
<h2>Requirements to merge (${counts(reqs)})</h2>${table([...(c.status === 'awaiting-merge' ? ['Reject row'] : []), 'ID', 'Status', 'Superseded value', 'New value'], reqs.map((r) => [...(c.status === 'awaiting-merge' ? [`<input type="checkbox" class="reject-row" value="${esc(r.id)}" title="Reject this row only">`] : []), esc(r.id), artPill(r.status), r.previous ? `<span class="old">${esc(r.previous.text)}</span>` : '-', `<span class="newv">${esc(r.text)}</span>`]), (i) => `row-${reqs[i].status}`)}
<h2>Test cases to merge (${counts(tcs)})</h2>${table(['Key', 'Req', 'Status', 'Superseded', 'New'], tcs.map((t) => [esc(t.key), esc(t.requirementId), artPill(t.status),
    t.previous ? `<span class="old">${esc(t.previous.name)}<br>${esc(t.previous.expected)}</span>` : '-', `<span class="newv">${esc(t.name)}</span><br>${esc(t.expected)}`]), (i) => `row-${tcs[i].status}`)}
<h2>Scripts to merge (${counts(scripts)})</h2>${table(['File', 'Covers', 'Status', 'Superseded assertion(s)', 'New assertion(s)'], scripts.map((s) => {
    const newL = changedLines(s.code, s.previous && s.previous.code);
    const oldL = s.previous ? changedLines(s.previous.code, s.code) : [];
    return [`<a href="#/scripts?cycle=${esc(c.id)}&file=${esc(s.file)}">${esc(s.file)}</a>`, esc(s.covers.join(', ')), artPill(s.status),
      oldL.length ? `<code class="old">${oldL.map((l) => esc(l.trim())).join('<br>')}</code>` : '-', s.previous ? `<code class="newv">${newL.map((l) => esc(l.trim())).join('<br>')}</code>` : `<span class="small">new spec, ${s.code.split('\n').length} lines</span>`];
  }), (i) => `row-${scripts[i].status}`)}
${c.status === 'awaiting-merge' ? `<div class="card"><div class="row"><label>Approver <input type="text" id="approver" value="${esc(localStorage.getItem('aqe-user') || '')}"></label><label>Comment <input type="text" id="mcomment" size="40"></label>
<button class="btn good" id="merge-approve">Approve merge</button><button class="btn danger" id="merge-reject">Reject</button><span id="merge-msg" class="small"></span></div></div>` : ''}`;
}

function executionView(c) {
  const ex = c.artifacts.execution;
  const s = ex.summary;
  return `<h2>Execution ${pill('executed', 'executed')}</h2>
<div class="kpis"><div class="kpi">Test cases<b>${s.total}</b></div><div class="kpi">Executed<b>${s.executed}</b></div><div class="kpi">Passed<b>${s.passed}</b></div><div class="kpi">Failed<b>${s.failed}</b></div><div class="kpi">Not run (manual)<b>${s.notRun}</b></div><div class="kpi">Pass rate<b>${s.passRate}%</b></div><div class="kpi">Duration<b>${s.durationMs} ms</b></div></div>
<p class="small">Really executed by <b>${esc(ex.tool)}</b> against <b>${esc(ex.sut.name)}</b> (build <code>${esc(ex.sut.build)}</code>, ${esc(ex.sut.url)}) from ${fmtTime(ex.startedAt)} to ${fmtTime(ex.finishedAt)}. Exit code ${ex.exitCode}. Command: <code>${esc(ex.command)}</code>. <a href="/api/cycles/${esc(c.id)}/playwright-report.json" target="_blank">Raw Playwright JSON report</a></p>
${table(['Case', 'Req', 'Name', 'Result', 'Duration', 'Failure / note', 'Evidence'], ex.results.map((r) => [esc(r.key), esc(r.requirementId), esc(r.name), pill(r.status, r.status),
    r.duration != null ? `${r.duration} ms` : '-', r.error ? `<code>${esc(r.error.assertion || '')}</code><br>expected <b>${esc(r.error.expected)}</b>, actual <b>${esc(r.error.actual)}</b><br><span class="small muted">${esc(r.error.location || '')}</span>` : esc(r.reason || ''),
    (r.evidence || []).map((e) => `<a class="small" target="_blank" href="/api/cycles/${esc(c.id)}/evidence/${esc(e.file)}">${esc(e.name)}</a>`).join('<br>')]), (i) => `row-${ex.results[i].status}`)}`;
}

function defectsView(c) {
  const d = c.artifacts.defects;
  const res = c.artifacts.resolvedDefects || [];
  return `<h2>Defects (${d.length})</h2><p class="muted small">Raised only from test cases that actually failed in the real Playwright run of this cycle.</p>
${d.length ? d.map((x) => `<div class="card"><h3>${esc(x.id)} - ${esc(x.title)} ${pill(x.severity, 'failed')} ${pill(x.movement, x.movement === 'new' ? 'failed' : 'enhanced')}</h3>
<div class="grid2"><div><b>Expected:</b> <span class="newv">${esc(x.expected)}</span><br><b>Actual:</b> <span class="old" style="text-decoration:none">${esc(x.actual)}</span><br><b>Severity:</b> ${esc(x.severity)}${x.impact ? ` (${esc(x.impact)})` : ''}<br><b>Release:</b> ${esc(x.releaseDecision || 'not assessed')}<br><b>Suspected code area:</b> <code>${esc(x.suspectedCodeArea || '-')}</code><br><b>Failing assertion:</b> <code>${esc(x.assertion)}</code> <span class="small muted">(${esc(x.location)})</span></div>
<div><b>Test case:</b> <a href="#/cycle/${esc(c.id)}?tab=testcases">${esc(x.testCaseKey)}</a> · <b>Script:</b> <a href="#/scripts?cycle=${esc(c.id)}&file=${esc(x.scriptFile)}">${esc(x.scriptFile)}</a><br><b>Requirement:</b> <a href="#/cycle/${esc(c.id)}?tab=requirements">${esc(x.requirementId)}</a> ${esc(x.requirementText)}<br><b>Rule:</b> ${esc(x.ruleId || '-')} · <b>Source:</b> ${esc((x.sourceRefs || x.jiraKeys).join(', '))} · first seen ${esc(x.firstSeenCycle)}</div></div>
<details><summary class="small">Error output and evidence</summary><pre class="code">${esc(x.errorMessage)}</pre>${x.evidence.map((e) => `<a class="small" target="_blank" href="/api/cycles/${esc(c.id)}/evidence/${esc(e.file)}">${esc(e.name)}</a>`).join(' · ')}</details></div>`).join('') : '<div class="banner ok">No test case failed, so no defects were raised.</div>'}
${res.length ? `<h3>Resolved since previous cycle</h3>${table(['ID', 'Title', 'Case'], res.map((x) => [esc(x.id), esc(x.title), esc(x.testCaseKey)]))}` : ''}`;
}

function reportView(c) {
  const r = c.report;
  return `<div class="row"><h2 style="margin:0">Cycle report</h2><a class="btn" href="/api/cycles/${esc(c.id)}/report.html" target="_blank">Open HTML</a><a class="btn secondary" href="/api/cycles/${esc(c.id)}/report.html?download=1">Download HTML</a><a class="btn secondary" href="/api/cycles/${esc(c.id)}/report.xlsx">Download Excel</a></div>
<div class="kpis" style="margin-top:10px"><div class="kpi">Requirements<b>${r.requirements.total}</b></div><div class="kpi">Test cases<b>${r.testCases.total}</b></div><div class="kpi">Scripts<b>${r.scripts.total}</b></div><div class="kpi">Executed<b>${r.execution.executed ? r.execution.summary.executed : 0}</b></div><div class="kpi">Pass rate<b>${r.execution.executed ? `${r.execution.summary.passRate}%` : 'n/a'}</b></div><div class="kpi">Defects<b>${r.defects.open.length}</b></div><div class="kpi">Coverage (passing)<b>${r.coverage ? r.coverage.percent.passing : 0}%</b></div></div>
<div class="card"><b>Summary</b><p>${esc(r.narrative.text)}</p><p class="muted small">${esc(r.narrative.draftedBy)}</p></div>
<div class="card" id="report-skills"><b>Active skills (${(r.skills || []).length})</b> · hand-over <span class="hand ${r.handoverStatus === 'complete' ? 'ok' : 'bad'}">${esc(r.handoverStatus || 'not checked')}</span>
<p class="small">${(r.skills || []).map((s) => `${pill(s.id, 'designed')} ${esc(s.name)}`).join('<br>') || 'No skills were active for this cycle.'}</p><a class="small" href="#/cycle/${esc(c.id)}?tab=skills">Hand-over detail per phase</a></div>
<iframe class="report" src="/api/cycles/${esc(c.id)}/report.html" title="Cycle report"></iframe>`;
}

/* bind merge buttons after render */
document.addEventListener('click', async (ev) => {
  const id = ev.target.id;
  if (id !== 'merge-approve' && id !== 'merge-reject') return;
  const cycleId = location.hash.match(/cycle\/([^?]+)/)[1];
  const approver = document.getElementById('approver').value.trim();
  const msg = document.getElementById('merge-msg');
  if (!approver) { msg.textContent = 'Enter the approver name'; return; }
  localStorage.setItem('aqe-user', approver);
  ev.target.disabled = true;
  try {
    await api(`/api/cycles/${cycleId}/merge`, { method: 'POST', body: { decision: id === 'merge-approve' ? 'approve' : 'reject', approver, comment: document.getElementById('mcomment').value,
      rejectedRows: [...document.querySelectorAll('.reject-row')].filter((x) => x.checked).map((x) => x.value) } });
    location.hash = `#/cycle/${cycleId}?tab=${id === 'merge-approve' ? 'execution' : 'merge'}`;
    route();
  } catch (e) { msg.textContent = e.message; ev.target.disabled = false; }
});

/* ---------------- per-artifact pages with a cycle picker ---------------- */
async function pickCycle(params, title, render, needs) {
  setTitle(title);
  const cycles = await api('/api/cycles');
  const eligible = cycles.filter(needs);
  let id = params.get('cycle') || (eligible.length ? eligible[eligible.length - 1].id : null);
  const picker = `<div class="row"><h1 style="margin:0">${esc(title)}</h1><label class="small">Cycle <select id="cyc">${cycles.map((c) => `<option value="${esc(c.id)}" ${c.id === id ? 'selected' : ''}>${esc(c.id)} - ${esc(c.name)} (${esc(c.status)})</option>`).join('')}</select></label></div>`;
  if (!id) { $view.innerHTML = `${picker}<p class="muted">No cycle has produced this yet. <a href="#/run">Run a cycle</a>.</p>`; return; }
  const c = await api(`/api/cycles/${id}`);
  let body;
  try { body = render(c, params); } catch (e) { body = `<div class="banner info">Not available for ${esc(c.id)} yet (${esc(c.status)}).</div>`; }
  $view.innerHTML = `${picker}<p class="small"><a href="#/cycle/${esc(c.id)}">Open ${esc(c.id)} artifacts by phase</a></p>${body}`;
  document.getElementById('cyc').onchange = (e) => { location.hash = `#/${location.hash.split('?')[0].slice(2)}?cycle=${e.target.value}`; };
  const f = params.get('file');
  if (f) { const el = document.getElementById(`s-${f}`); if (el) el.scrollIntoView(); }
}

async function viewReports() {
  setTitle('Reports');
  const cycles = (await api('/api/cycles')).filter((c) => c.status === 'completed');
  $view.innerHTML = `<h1>Reports</h1>${table(['Cycle', 'Name', 'Type', 'Execution', 'Report'], cycles.map((c) => [esc(c.id), esc(c.name), esc(c.type), c.summary ? `${c.summary.passed}/${c.summary.executed} passed (${c.summary.passRate}%)` : '-',
    `<a href="#/cycle/${esc(c.id)}?tab=report">View</a> · <a href="/api/cycles/${esc(c.id)}/report.html" target="_blank">HTML</a> · <a href="/api/cycles/${esc(c.id)}/report.html?download=1">download HTML</a> · <a href="/api/cycles/${esc(c.id)}/report.xlsx">Excel</a> · <a href="/api/cycles/${esc(c.id)}/export/testcases.xlsx">test cases .xlsx</a>`]))}
${cycles.length >= 2 ? '<p><a class="btn" href="#/compare">Compare cycles</a></p>' : ''}`;
}

async function viewCompare(params) {
  setTitle('Compare');
  const cycles = (await api('/api/cycles')).filter((c) => c.status === 'completed');
  if (cycles.length < 2) { $view.innerHTML = '<h1>Compare cycles</h1><p class="muted">Two completed cycles are needed (a baseline and an incremental cycle).</p>'; return; }
  const a = params.get('a') || cycles[cycles.length - 2].id;
  const b = params.get('b') || cycles[cycles.length - 1].id;
  const sel = (name, v) => `<select id="${name}">${cycles.map((c) => `<option value="${esc(c.id)}" ${c.id === v ? 'selected' : ''}>${esc(c.id)} - ${esc(c.name)}</option>`).join('')}</select>`;
  const cmp = await api(`/api/compare?a=${a}&b=${b}`);
  const row = (label, d) => [`<b>${esc(label)}</b>`, d.countA, d.countB, `<b>${d.added.length}</b><br><span class="small">${esc(d.added.join(', '))}</span>`, `<b>${d.changed.length}</b><br><span class="small">${esc(d.changed.join(', '))}</span>`, `<b>${d.unchanged.length}</b>`];
  const ea = cmp.execution.a;
  const eb = cmp.execution.b;
  const q = `a=${esc(a)}&b=${esc(b)}`;
  $view.innerHTML = `<div class="row"><h1 style="margin:0">Compare cycles</h1>${sel('ca', a)} vs ${sel('cb', b)}
<a class="btn secondary" href="/api/compare.html?${q}" target="_blank">Open HTML</a><a class="btn secondary" href="/api/compare.html?${q}&download=1">Download HTML</a><a class="btn secondary" href="/api/compare.xlsx?${q}">Download Excel</a></div>
<div class="grid2"><div class="card"><h3>${esc(cmp.a.id)} - ${esc(cmp.a.name)}</h3>${ea.passed}/${ea.executed} passed · pass rate <b>${ea.passRate}%</b> · defects ${esc(cmp.defects.a.join(', ') || 'none')}</div>
<div class="card"><h3>${esc(cmp.b.id)} - ${esc(cmp.b.name)}</h3>${eb.passed}/${eb.executed} passed · pass rate <b>${eb.passRate}%</b> · defects ${esc(cmp.defects.b.join(', ') || 'none')}</div></div>
<h2>Artifacts</h2>${table(['Artifact', cmp.a.id, cmp.b.id, 'Added', 'Changed', 'Unchanged'], [row('Requirements', cmp.requirements), row('Test cases', cmp.testCases), row('Scripts', cmp.scripts)])}
<h2>Changed requirements</h2>${table(['ID', `Before (${cmp.a.id})`, `After (${cmp.b.id})`], cmp.requirements.changedDetail.map((d) => [esc(d.id), `<span class="old">${esc(d.before)}</span>`, `<span class="newv">${esc(d.after)}</span>`]))}
<h2>Execution and defect movement</h2>${table(['Metric', cmp.a.id, cmp.b.id], ['executed', 'passed', 'failed', 'passRate'].map((k) => [esc(k), ea[k], eb[k]]))}
<p>Pass-rate movement: <b>${cmp.execution.passRateDelta > 0 ? '+' : ''}${cmp.execution.passRateDelta} pts</b> · new defects: <b>${esc(cmp.defects.new.join(', ') || 'none')}</b> · still open: <b>${esc(cmp.defects.stillOpen.join(', ') || 'none')}</b> · resolved: <b>${esc(cmp.defects.resolved.join(', ') || 'none')}</b></p>`;
  const go = () => { location.hash = `#/compare?a=${document.getElementById('ca').value}&b=${document.getElementById('cb').value}`; };
  document.getElementById('ca').onchange = go;
  document.getElementById('cb').onchange = go;
}

async function viewBaselines() {
  setTitle('Baselines');
  const bs = await api('/api/baselines');
  $view.innerHTML = `<h1>Baselines</h1>${bs.length ? bs.map((b) => `<div class="card"><h3>${esc(b.id)} v${b.version} - ${esc(b.name)}</h3><p>${b.counts.requirements} requirements · ${b.counts.testCases} test cases · ${b.counts.scripts} scripts · cycles ${esc(b.cycles.join(', '))}</p>
${table(['Version', 'When', 'Cycle', 'Change', 'Approved by'], b.history.map((h) => [`v${h.version}`, fmtTime(h.at), esc(h.cycleId), esc(h.change), esc(h.approvedBy)]))}</div>`).join('') : '<p class="muted">No baseline yet.</p>'}`;
}

/* ---------------- router ---------------- */
let lastPath = null;
async function route() {
  clearTimeout(pollTimer);
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?');
  if (path !== lastPath) { window.scrollTo(0, 0); lastPath = path; }
  const params = new URLSearchParams(query || '');
  const parts = path.split('/');
  activeNav(parts[0] === 'cycle' ? 'cycles' : parts[0]);
  try {
    if (!META) await loadMeta();
    switch (parts[0]) {
      case '': return await viewHome();
      case 'run': return await viewRun(params);
      case 'cycles': return await viewCycles();
      case 'cycle': return await viewCycle(parts[1], params);
      case 'testcases': return await pickCycle(params, 'Test cases', testCasesView, (c) => ['completed', 'awaiting-merge'].includes(c.status));
      case 'scripts': return await pickCycle(params, 'Scripts', scriptsView, (c) => ['completed', 'awaiting-merge'].includes(c.status));
      case 'execution': return await pickCycle(params, 'Execution', executionView, (c) => c.status === 'completed');
      case 'defects': return await pickCycle(params, 'Defects', defectsView, (c) => c.status === 'completed');
      case 'reports': return await viewReports();
      case 'compare': return await viewCompare(params);
      case 'baselines': return await viewBaselines();
      default: $view.innerHTML = '<p>Not found.</p>';
    }
  } catch (e) {
    $view.innerHTML = `<div class="banner err">${esc(e.message)}</div>`;
  }
}
window.addEventListener('hashchange', route);
route();
