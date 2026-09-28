'use strict';
// Optional model: drafts prose only (report narrative). Every number it is given was computed in code.
// Without ANTHROPIC_API_KEY the app runs in deterministic demo mode with a template narrative.

function modelConfig(env = process.env) {
  if (!env.ANTHROPIC_API_KEY) return null;
  return { apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL || 'claude-sonnet-4-5' };
}

function templateNarrative(f) {
  const parts = [
    `${f.cycleName} (${f.cycleType}) worked from ${f.inputs}.`,
    `The reviewed requirement set holds ${f.requirements} requirements${f.delta ? ` (${f.delta})` : ''}.`,
    `${f.testCases} test cases are designed, ${f.automated} of them automated in ${f.scripts} Playwright scripts.`,
    f.executed ? `Execution ran ${f.executed} automated cases for real: ${f.passed} passed and ${f.failed} failed (pass rate ${f.passRate}%).` : 'The suite has not been executed yet.',
    f.defects ? `${f.defects} defect(s) were raised from real failures: ${f.defectTitles}.` : 'No defects were raised.',
  ];
  return parts.join(' ');
}

async function draftNarrative(facts, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const fallback = { text: templateNarrative(facts), draftedBy: 'Deterministic template (demo mode - no model API key set)' };
  const cfg = modelConfig(env);
  if (!cfg) return fallback;
  try {
    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 400,
        messages: [{ role: 'user', content: `Write a 4-sentence business summary of this QA cycle for a non-technical reader. Use only these facts; do not invent numbers.\n${JSON.stringify(facts)}` }],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const text = (json.content || []).map((c) => c.text || '').join('').trim();
    if (!text) throw new Error('empty response');
    return { text, draftedBy: `Model (${cfg.model}) - prose only; all figures computed in code` };
  } catch (e) {
    return { ...fallback, draftedBy: `Deterministic template (model call failed: ${e.message})` };
  }
}

module.exports = { draftNarrative, modelConfig, templateNarrative };
