'use strict';
// Devin engine: one Devin session per cycle runs all six agents (protocol eqe-cycle/1, see kit/PROTOCOL.md).
// Each stage here waits for its section of the session's structured output and maps it onto the run,
// so the dashboard, gates, exports and reporting work the same as with the rule-based agents.
const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const client = require('./client');
const { schema, PHASES } = require('./schema');
const brief = require('./brief');
const jira = require('../jira');
const store = require('../store');
const { ROOT, runDir } = store;
const { LEVELS, STAGES: JOURNEY } = require('../catalog');
const executionAgent = require('../agents/execution');
const reportingAgent = require('../agents/reporting');

const POLL_MS = Number(process.env.DEVIN_POLL_SECONDS || 15) * 1000;
const STAGE_TIMEOUT_MS = Number(process.env.DEVIN_STAGE_TIMEOUT_MINUTES || 90) * 60_000;
const NUDGE_AFTER_MS = Number(process.env.DEVIN_NUDGE_MINUTES || 12) * 60_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PHASE_ORDER = ['starting', 'intake', 'analysis', 'design', 'awaiting_test_approval', 'scripts', 'execution', 'awaiting_execution_review', 'reporting', 'done'];
const atLeast = (o, phase) => PHASE_ORDER.indexOf(o.phase) >= PHASE_ORDER.indexOf(phase);
const GATES = ['awaiting_test_approval', 'awaiting_execution_review'];

async function jiraIssues(initiative) {
  const pick = (i) => ({ key: i.key, issuetype: i.fields.issuetype?.name, summary: i.fields.summary, priority: i.fields.priority?.name, status: i.fields.status?.name,
    labels: i.fields.labels || [], parent: i.fields.parent?.key || null, description: i.fields.description || null });
  const init = await jira.issue(initiative);
  const epics = await jira.search(`parent = ${initiative} AND issuetype = Epic ORDER BY key`);
  const stories = [];
  for (const e of epics) stories.push(...await jira.search(`parent = ${e.key} AND issuetype in (Story, Task) ORDER BY key`));
  if (!stories.length) throw new Error(`No stories found under ${initiative}`);
  return { source: jira.JIRA_URL, initiative: pick(init), epics: epics.map(pick), stories: stories.map(pick) };
}

async function start(run, { log }) {
  if (!client.configured()) throw new Error('Devin engine selected but DEVIN_API_KEY / DEVIN_ORG_ID are not set (see .env.example)');
  log(`Reading initiative ${run.config.initiative} from ${jira.JIRA_URL} for the Devin session`);
  const raw = await jiraIssues(run.config.initiative);
  fs.mkdirSync(path.join(runDir(run.id), 'devin'), { recursive: true });
  fs.writeFileSync(path.join(runDir(run.id), 'devin', 'jira-issues.json'), JSON.stringify(raw, null, 2));
  const criteria = JSON.parse(fs.readFileSync(path.join(ROOT, 'dashboard', 'config', 'release-criteria.json'), 'utf8'));
  const { file, cycle } = await brief.buildBundle(run, raw, criteria);
  log(`Uploading ${path.basename(file)} (${Math.round(fs.statSync(file).size / 1024)} KB: protocol, automation template, ${raw.stories.length} Jira stories${cycle.app.mode === 'bundled' ? ', StayEase app' : ''}) to Devin`);
  const up = await client.uploadAttachment(file);
  const text = brief.prompt(run, cycle, path.basename(file));
  const body = {
    prompt: text, title: `EQE ${run.id} · ${run.config.initiative} · ${cycle.app.mode === 'bundled' ? `StayEase ${cycle.app.release}` : cycle.app.url}`,
    tags: ['eqe', `eqe-${run.id.toLowerCase()}`], attachment_urls: [up.url],
    structured_output_schema: schema, structured_output_required: false,
  };
  if (process.env.DEVIN_MAX_ACU) body.max_acu_limit = Number(process.env.DEVIN_MAX_ACU);
  if (process.env.DEVIN_KNOWLEDGE_IDS) body.knowledge_ids = process.env.DEVIN_KNOWLEDGE_IDS.split(',').map((s) => s.trim()).filter(Boolean);
  if (process.env.DEVIN_PLAYBOOK_ID) body.playbook_id = process.env.DEVIN_PLAYBOOK_ID;
  fs.writeFileSync(path.join(runDir(run.id), 'devin', 'create-session.json'), JSON.stringify({ ...body, structured_output_schema: '(see src/devin/schema.js)' }, null, 2));
  const s = await client.createSession(body);
  run.devin = { sessionId: s.session_id, url: s.url, createdAt: new Date().toISOString(), status: s.status, phase: 'starting', acus: 0, bundle: path.basename(file), attachmentId: up.attachment_id, messages: [], seen: [] };
  log(`Devin session created: ${s.url}`);
}

function mergeLog(run, out, log) {
  const seen = new Set(run.devin.seen);
  for (const l of out.log || []) {
    const k = `${l.stage || ''}|${l.msg}`;
    if (seen.has(k)) continue;
    seen.add(k); run.devin.seen.push(k);
    log(`Devin: ${l.msg}`, l.level || 'info');
  }
  run.devin.seen = run.devin.seen.slice(-300);
}

// Polls the session until `ready(output)` holds; nudges an idle session and fails on errors, rejections and timeouts.
const PHASE_NOTE = { starting: 'Devin is starting the session and StayEase', intake: 'Devin is reading the Jira stories', analysis: 'Devin is analysing the requirements', design: 'Devin is designing test cases',
  awaiting_test_approval: 'Devin is reading the approval', scripts: 'Devin is exploring the app and writing scripts', execution: 'Devin is running the specs', awaiting_execution_review: 'Devin is uploading the results', reporting: 'Devin is writing the report' };
// How far a stage is, from Devin's reported phase and how many cases it has scripted or run so far.
function devinProgress(stage, out, run) {
  const at = PHASES.indexOf(out.phase || 'starting');
  const approved = Math.max(1, run.testCases ? run.testCases.filter((c) => c.automation === 'Automation' && !(run.review?.excluded || []).includes(c.id)).length : 1);
  const note = PHASE_NOTE[out.phase] || PHASE_NOTE.starting;
  const own = { intake: 'intake', analysis: 'analysis', design: 'design', scripts: 'scripts', execution: 'execution', reporting: 'reporting' }[stage];
  const mine = PHASES.indexOf(own);
  if (at < mine) return [stage === 'intake' ? 15 : 10, note];
  if (stage === 'scripts' && at === mine) { const n = out.scripts?.cases?.length || 0; return [20 + (75 * n) / approved, n ? `${note}: ${n} of ${approved} scripted` : note]; }
  if (stage === 'execution' && at === mine) { const n = out.execution?.results?.length || 0; return [20 + (70 * n) / approved, n ? `${note}: ${n} of ${approved} run` : note]; }
  return [at === mine ? 50 : 90, note];
}

async function waitFor(run, { log, isCancelled, progress, stage }, label, ready) {
  const t0 = Date.now(); let lastChange = Date.now(); let lastNudge = 0; let lastSig = '';
  for (;;) {
    if (isCancelled()) throw new Error('Cancelled');
    const s = await client.getSession(run.devin.sessionId);
    const out = s.structured_output || {};
    const sig = JSON.stringify(out).length + (out.phase || '') + s.status_detail;
    if (sig !== lastSig) { lastSig = sig; lastChange = Date.now(); }
    Object.assign(run.devin, { status: s.status, statusDetail: s.status_detail || null, acus: s.acus_consumed ?? run.devin.acus, phase: out.phase || run.devin.phase, polledAt: new Date().toISOString() });
    run.devin.output = out;
    mergeLog(run, out, log);
    if (progress && stage) progress(...devinProgress(stage, out, run));
    fs.writeFileSync(path.join(runDir(run.id), 'devin', 'structured-output.json'), JSON.stringify(out, null, 2));
    store.saveRun(run);
    if (out.phase === 'failed') throw new Error(`Devin reported the cycle failed: ${out.error || 'no reason given'}`);
    if (out.protocol && ready(out)) return out;
    if (['exit', 'error'].includes(s.status)) throw new Error(`Devin session ended (${s.status}${s.status_detail ? `, ${s.status_detail}` : ''}) before ${label}`);
    const idle = Date.now() - lastChange;
    if ((s.status === 'suspended' || (s.status_detail === 'waiting_for_user' && !GATES.includes(out.phase))) && idle > NUDGE_AFTER_MS && Date.now() - lastNudge > NUDGE_AFTER_MS) {
      lastNudge = Date.now();
      await send(run, `EQE-CONTINUE: the dashboard is waiting for ${label}. Continue the cycle as PROTOCOL.md describes and submit the structured output (current phase: ${out.phase || 'none'}).`, log);
    }
    if (Date.now() - t0 > STAGE_TIMEOUT_MS) throw new Error(`Timed out after ${Math.round(STAGE_TIMEOUT_MS / 60000)} min waiting for ${label}`);
    await sleep(POLL_MS);
  }
}

async function send(run, message, log) {
  await client.sendMessage(run.devin.sessionId, message);
  run.devin.messages.push({ t: new Date().toISOString(), message });
  log(`Message sent to the Devin session: ${message.split(' ')[0]}`);
}

const STAGE_LABEL = Object.fromEntries(JOURNEY.map((s) => [s.id, s.label]));

// ---- 1. Intake ----
async function intake(run, ctx) {
  if (!run.devin) await start(run, ctx);
  const out = await waitFor(run, ctx, 'the intake output', (o) => o.intake?.stories?.length && atLeast(o, 'analysis'));
  const raw = JSON.parse(fs.readFileSync(path.join(runDir(run.id), 'devin', 'jira-issues.json'), 'utf8'));
  const rawOf = Object.fromEntries(raw.stories.map((s) => [s.key, s]));
  const stories = out.intake.stories.map((s) => ({
    key: s.key, summary: s.summary || rawOf[s.key]?.summary, epicKey: s.epicKey || rawOf[s.key]?.parent, epicSummary: raw.epics.find((e) => e.key === (s.epicKey || rawOf[s.key]?.parent))?.summary,
    priority: s.priority || rawOf[s.key]?.priority || 'Medium', status: rawOf[s.key]?.status, labels: rawOf[s.key]?.labels || [], text: s.text || '', ac: s.ac || [], testData: s.testData || {},
  }));
  run.requirements = {
    source: jira.JIRA_URL, readAt: new Date().toISOString(), engine: 'devin',
    initiative: { key: raw.initiative.key, summary: raw.initiative.summary, text: jira.parseDescription(raw.initiative.description).text, priority: raw.initiative.priority },
    epics: raw.epics.map((e) => ({ key: e.key, summary: e.summary, priority: e.priority, stories: stories.filter((s) => s.epicKey === e.key).map((s) => s.key) })),
    stories, gaps: out.intake.gaps || [], aiSummary: out.intake.summary || '',
  };
  const n = stories.reduce((k, s) => k + s.ac.length, 0);
  return `${raw.epics.length} epics · ${stories.length} stories · ${n} acceptance criteria (extracted by Devin)${run.requirements.gaps.length ? ` · ${run.requirements.gaps.length} gap(s)` : ''}`;
}

// ---- 2. Analysis ----
async function analysis(run, ctx) {
  const out = await waitFor(run, ctx, 'the analysis output', (o) => o.analysis?.stories?.length && atLeast(o, 'design'));
  const aiOf = Object.fromEntries(out.analysis.stories.map((s) => [s.key, s]));
  const stories = run.requirements.stories.map((s) => {
    const a = aiOf[s.key] || { acs: [], findings: [], risk: 'Medium', qualityScore: 0, stage: 'unknown' };
    const acOf = Object.fromEntries((a.acs || []).map((x) => [x.id, x]));
    const acs = s.ac.map((ac) => {
      const x = acOf[ac.id] || { technique: 'Not analysed by Devin', kind: 'manual', testability: 'Needs human design', issues: ['Devin returned no analysis for this criterion'] };
      return { ...ac, storyKey: s.key, technique: 'ai', label: x.technique, kind: x.kind === 'negative' ? 'variant' : x.kind, aiKind: x.kind, stage: a.stage, params: {}, reason: x.reason || '', messages: [], entities: [], testability: x.testability, issues: x.issues || [] };
    });
    const stage = a.stage || 'unknown';
    return { key: s.key, summary: s.summary, epicKey: s.epicKey, priority: s.priority, stage, stageLabel: a.stageLabel || STAGE_LABEL[stage] || 'Unmapped',
      risk: a.risk, riskScore: '', riskReason: a.riskReason || '', qualityScore: a.qualityScore, findings: a.findings || [], questions: a.questions || [], acs };
  });
  const all = stories.flatMap((s) => s.acs);
  run.analysis = {
    engine: 'devin', aiSummary: out.analysis.summary || '', stories,
    totals: {
      stories: stories.length, acs: all.length, testable: all.filter((a) => a.testability === 'Testable').length, ambiguous: all.filter((a) => a.testability === 'Ambiguous').length,
      notObservable: all.filter((a) => a.testability === 'Not UI-observable').length, needsDesign: all.filter((a) => a.testability === 'Needs human design').length,
      automatable: all.filter((a) => a.kind !== 'manual').length, avgQuality: Math.round(stories.reduce((n, s) => n + (s.qualityScore || 0), 0) / (stories.length || 1)),
      highRisk: stories.filter((s) => s.risk === 'High').length,
    },
    journey: ['search', 'hotel', 'member', 'booking', 'find'].map((st) => ({ stage: st, label: STAGE_LABEL[st], stories: stories.filter((s) => s.stage === st || (st === 'search' && s.stage === 'results')).map((s) => s.key) })),
    unmapped: stories.filter((s) => s.stage === 'unknown').map((s) => s.key),
  };
  const t = run.analysis.totals;
  return `${t.acs} AC analysed by Devin · ${t.automatable} automatable · ${t.ambiguous} ambiguous · ${t.notObservable} not UI-observable · ${stories.reduce((n, s) => n + s.questions.length, 0)} question(s) for the PO`;
}

// ---- 3. Test design ----
const NEG_RE = /\b(negative|boundary|invalid|out[- ]of[- ]range)\b/i;
const isNegativeOrBoundary = (tc) => NEG_RE.test(tc.type || '') || /^(negative|boundary)\b/i.test(tc.technique || '');
const isNegativeOrBoundaryAc = (a) => a.aiKind === 'negative' || /^(negative|boundary)\b/i.test(a.label || '');

async function design(run, ctx) {
  const out = await waitFor(run, ctx, 'the test design', (o) => o.design?.testCases?.length && atLeast(o, 'awaiting_test_approval'));
  const acs = run.analysis.stories.flatMap((s) => s.acs);
  const storyOfAc = Object.fromEntries(acs.map((a) => [a.id, a.storyKey]));
  const dropped = out.design.testCases.filter(isNegativeOrBoundary);
  const outOfScope = acs.filter(isNegativeOrBoundaryAc).map((a) => a.id);
  const cases = out.design.testCases.filter((tc) => !isNegativeOrBoundary(tc)).map((tc) => ({
    id: tc.id, title: tc.title, type: tc.type, automation: tc.automation, priority: tc.priority, technique: 'ai-designed',
    acIds: (tc.acIds || []).filter((id) => storyOfAc[id]), storyKeys: tc.storyKeys?.length ? tc.storyKeys : [...new Set((tc.acIds || []).map((id) => storyOfAc[id]).filter(Boolean))],
    steps: tc.steps.map((s, i) => ({ kind: tc.automation === 'Automation' ? 'ai' : 'manual', n: s.n || i + 1, action: s.action, expected: s.expected || '' })),
    preconditions: tc.preconditions || '', data: tc.data || {}, rationale: tc.rationale || '', needsClarification: !!tc.needsClarification,
    origin: 'agent', level: LEVELS.agent, engine: 'devin',
  }));
  const covered = new Set(cases.flatMap((c) => c.acIds));
  const inScope = acs.filter((a) => !outOfScope.includes(a.id));
  const table = run.requirements.stories.flatMap((s) => Object.entries(s.testData || {}).map(([name, value]) => ({ name, value, story: s.key })));
  run.testCases = cases;
  run.design = {
    engine: 'devin', aiSummary: out.design.summary || '', total: cases.length, automation: cases.filter((c) => c.automation === 'Automation').length, manual: cases.filter((c) => c.automation === 'Manual').length,
    acCovered: inScope.filter((a) => covered.has(a.id)).length, acTotal: inScope.length, acCoverage: Math.round((inScope.filter((a) => covered.has(a.id)).length / (inScope.length || 1)) * 1000) / 10,
    uncovered: inScope.filter((a) => !covered.has(a.id)).map((a) => a.id), uncoveredReasons: out.design.uncovered || [], outOfScope, droppedCases: dropped.map((tc) => tc.id), testData: {}, testDataTable: table,
  };
  if (dropped.length) ctx.log(`Positive flows only: dropped ${dropped.length} negative/boundary case(s) from Devin (${dropped.map((tc) => tc.id).join(', ')})`);
  if (outOfScope.length) ctx.log(`Positive flows only: ${outOfScope.length} negative/boundary acceptance criteria out of scope (${outOfScope.join(', ')})`);
  cases.forEach((c) => ctx.log(`${c.id} [${c.automation}] ${c.title} → ${c.acIds.join(', ')}`));
  return `${cases.length} test cases designed by Devin (${run.design.automation} automatable, ${run.design.manual} manual) · AC coverage ${run.design.acCoverage}%`;
}

// ---- 4. Script generation (after gate 1) ----
async function scripts(run, ctx) {
  if (!run.devin.approvalSent) {
    const r = run.review || {};
    const added = run.testCases.filter((t) => t.origin === 'user').map(({ id, title, type, automation, priority, acIds, storyKeys, preconditions, steps }) => ({ id, title, type, automation, priority, acIds, storyKeys, preconditions, steps: steps.map(({ n, action, expected }) => ({ n, action, expected })) }));
    await send(run, `EQE-APPROVAL ${JSON.stringify({ approvedBy: r.approvedBy, note: r.note || '', excluded: [...new Set([...(r.excluded || []), ...(run.design.droppedCases || [])])], added })}`, ctx.log);
    run.devin.approvalSent = true;
  }
  const out = await waitFor(run, ctx, 'the automation scripts', (o) => o.scripts?.cases?.length && atLeast(o, 'execution'));
  const cases = out.scripts.cases.map((c) => ({ ...c, issues: c.issues || [], steps: c.steps || [], mcpCalls: Number.isInteger(c.mcpCalls) ? c.mcpCalls : null, ms: Number.isInteger(c.explorationMs) ? c.explorationMs : null, dryRunMismatches: 0 }));
  const reported = cases.filter((c) => c.mcpCalls != null);
  const pageObjects = (out.scripts.pageObjects || []).map((p) => ({ class: p.class, file: p.file, urls: [], locators: p.locators || [] }));
  run.scripts = { engine: 'devin', aiSummary: out.scripts.summary || '', dir: 'automation', mcpTools: [...new Set(cases.map((c) => c.explorationTool).filter(Boolean))], mcpCalls: reported.length ? reported.reduce((n, c) => n + c.mcpCalls, 0) : null, cases, pageObjects,
    generated: cases.filter((c) => c.status === 'generated').length, needsAttention: cases.filter((c) => c.status !== 'generated').length,
    locators: pageObjects.reduce((n, p) => n + p.locators.length, 0), dryRunMismatches: 0 };
  for (const c of cases) { const t = run.testCases.find((x) => x.id === c.tcId); if (t && c.status === 'generated') t.level = [t.origin === 'user' ? LEVELS.user : LEVELS.agent, LEVELS.automated].join(', '); }
  const s = run.scripts;
  return `${s.generated} scripts generated by Devin${s.needsAttention ? `, ${s.needsAttention} need attention` : ''} · ${pageObjects.length} page objects · ${s.locators} locators`;
}

// Downloads the automation zip the session attached and unpacks it into the run folder.
async function fetchAutomation(run, out, log) {
  const want = out.artifacts?.automationZip;
  // The session can report its results a little before its attachment upload finishes, so wait for it.
  let att;
  for (let i = 0; i < 12 && !att; i++) {
    if (i) await new Promise((r) => setTimeout(r, 15000));
    const items = await client.listAttachments(run.devin.sessionId);
    att = items.filter((a) => (want ? a.name === want : false) || /-automation\.zip$/i.test(a.name || '')).pop();
  }
  if (!att) { log(`No automation zip attached to the session${want ? ` (expected ${want})` : ''}; using Devin's reported results only`, 'warn'); return null; }
  const zip = path.join(runDir(run.id), 'devin', att.name);
  await client.downloadAttachment(att, zip);
  const dir = path.join(runDir(run.id), 'automation');
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const z = await unzipper.Open.file(zip);
  for (const f of z.files) {
    const rel = f.path.replace(/^(\.\/)?(automation\/)?/, '');
    const dest = path.join(dir, rel);
    if (!dest.startsWith(dir + path.sep) || f.type !== 'File') continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, await f.buffer());
  }
  log(`Downloaded ${att.name} from the session (${z.files.length} files) into ${path.relative(runDir(run.id), dir)}/`);
  return dir;
}

// Counts the Playwright MCP calls the session made per test case, from the bridge's log in the automation zip.
function applyMcpLog(run, dir) {
  const f = path.join(dir, 'results', 'mcp-calls.jsonl');
  if (!run.scripts || !fs.existsSync(f)) return 0;
  const calls = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const by = {};
  for (const c of calls) (by[c.tc] ||= []).push(c);
  for (const c of run.scripts.cases) { const mine = by[c.tcId] || []; c.mcpCalls = mine.length; c.ms = mine.reduce((n, x) => n + (x.ms || 0), 0); }
  run.scripts.mcpCalls = calls.length;
  run.scripts.mcpTools = [...new Set(calls.map((c) => c.tool))];
  return calls.length;
}

// ---- 5. Execution (gate 2 follows) ----
async function execution(run, ctx) {
  if (run.devin?.localRerun) return executionAgent(run, ctx);
  const out = await waitFor(run, ctx, 'the execution results', (o) => o.execution?.results && atLeast(o, 'awaiting_execution_review'));
  const triOf = Object.fromEntries(out.execution.results.map((r) => [r.tcId, r]));
  ctx.progress?.(95, 'Downloading the recordings, traces and HTML report from the session');
  const dir = await fetchAutomation(run, out, ctx.log).catch((e) => { ctx.log(`Could not download the automation zip: ${e.message}`, 'warn'); return null; });
  const mcp = dir ? applyMcpLog(run, dir) : 0;
  if (dir) ctx.log(mcp ? `Counted ${mcp} Playwright MCP calls from results/mcp-calls.jsonl` : 'The automation zip has no Playwright MCP call log (results/mcp-calls.jsonl)', mcp ? 'info' : 'warn');
  let parsed = dir && fs.existsSync(path.join(dir, 'results', 'results.json')) ? executionAgent.parseResults(run, dir, { remap: true }) : null;
  if (!parsed) {
    const results = out.execution.results.map((r) => ({ tcId: r.tcId, title: `${r.tcId} ${run.testCases.find((t) => t.id === r.tcId)?.title || ''}`, status: r.status, durationMs: r.durationMs || 0, error: r.error || null, failedStep: r.failedStep || null }));
    parsed = { passed: results.filter((r) => r.status === 'passed').length, failed: results.filter((r) => r.status === 'failed').length, skipped: results.filter((r) => r.status === 'skipped').length, durationMs: out.execution.durationMs || 0, results, htmlReport: null, exitCode: null };
  }
  for (const r of parsed.results) if (triOf[r.tcId]?.triage) r.triage = triOf[r.tcId].triage;
  run.execution = { ...parsed, engine: 'devin', aiSummary: out.execution.summary || '', browser: 'chromium (headless, in the Devin session)', baseUrl: out.app?.url || run.config.appUrl, startedAt: run.devin.createdAt, finishedAt: new Date().toISOString() };
  const e = run.execution;
  const defects = e.results.filter((r) => r.triage?.raiseDefect).length;
  return `${e.passed} passed · ${e.failed} failed · ${e.skipped} skipped (run in the Devin session) · Devin triage: ${defects} product defect(s)`;
}

// ---- 6. Reporting (after gate 2) ----
async function reporting(run, ctx) {
  if (run.devin?.localRerun) return reportingAgent(run, ctx);
  if (!run.devin.execReviewSent) {
    const xr = run.execReview || {};
    await send(run, `EQE-EXEC-REVIEW ${JSON.stringify({ approvedBy: xr.approvedBy, note: xr.note || '', defects: xr.defects || [], manual: xr.manual || [] })}`, ctx.log);
    run.devin.execReviewSent = true;
  }
  const out = await waitFor(run, ctx, 'the report', (o) => o.reporting?.executiveSummary && o.phase === 'done');
  run.aiDefects = out.reporting.defects || [];
  const summary = await reportingAgent(run, ctx);
  run.report.ai = { executiveSummary: out.reporting.executiveSummary, recommendation: out.reporting.recommendation || null, risks: out.reporting.risks || [], acus: run.devin.acus, session: run.devin.url };
  const md = path.join(runDir(run.id), 'test-summary.md');
  const rec = run.report.ai.recommendation;
  fs.writeFileSync(md, fs.readFileSync(md, 'utf8').replace(/\n## Metrics/, `\n## Executive summary (Devin)\n${run.report.ai.executiveSummary}\n${rec ? `\nDevin recommends **${rec.decision}**${(rec.reasons || []).length ? `: ${rec.reasons.join('; ')}` : ''}. The release decision above applies the release criteria.\n` : ''}\nDevin session: ${run.devin.url}\n\n## Metrics`));
  return `${summary}${rec ? ` · Devin recommends ${rec.decision}` : ''}`;
}

// Re-downloads the automation zip for a run that finished execution without it (videos, traces, HTML report).
async function recoverAutomation(run, log) {
  const out = (await client.getSession(run.devin.sessionId)).structured_output || {};
  const dir = await fetchAutomation(run, out, log);
  if (!dir || !fs.existsSync(path.join(dir, 'results', 'results.json'))) return false;
  applyMcpLog(run, dir);
  const parsed = executionAgent.parseResults(run, dir, { remap: true });
  const old = Object.fromEntries((run.execution?.results || []).map((r) => [r.tcId, r]));
  for (const r of parsed.results) if (old[r.tcId]?.triage) r.triage = old[r.tcId].triage;
  run.execution = { ...run.execution, ...parsed };
  return true;
}

module.exports = { recoverAutomation, applyMcpLog, intake, analysis, design, scripts, execution, reporting, send, jiraIssues, isNegativeOrBoundary, isNegativeOrBoundaryAc };
