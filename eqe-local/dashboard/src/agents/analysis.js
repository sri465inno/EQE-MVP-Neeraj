'use strict';
// Requirement analysis agent: classifies every acceptance criterion against the skill catalogue,
// scores story quality and risk, and flags ambiguity and gaps before test design.
const { classify, storyStage, quoted, mentions, STAGES, VAGUE } = require('../catalog');

const PRIORITY_W = { Highest: 3, High: 2, Medium: 1.5, Low: 1, Lowest: 1 };
const IMPACT = { member: 2.5, booking: 3, find: 2, search: 2, results: 1, hotel: 1.5, unknown: 1 };

module.exports = async function analysis(run, { log, progress = () => {} }) {
  const stories = run.requirements.stories;
  const out = [];
  for (const s of stories) {
    progress((100 * out.length) / stories.length, `Analysing story ${out.length + 1} of ${stories.length} (${s.key})`);
    const stage = storyStage(s.summary, s.epicSummary);
    const findings = [];
    const acs = s.ac.map((a) => {
      const c = classify(a.text, { stage, story: s });
      const issues = [];
      let testability = 'Testable';
      if (c.technique === 'ambiguous') { testability = 'Ambiguous'; issues.push(`Vague term "${c.params.term}" has no measurable threshold`); }
      else if (c.technique === 'not-observable') testability = 'Not UI-observable';
      else if (c.technique === 'unmatched') { testability = 'Needs human design'; issues.push('No catalogue pattern matched'); }
      if (c.kind === 'variant' && /message/i.test(a.text) && !quoted(a.text).length) issues.push('Expected message text is not specified');
      if (c.technique === 'required' && !c.params.fields.length) { testability = 'Needs human design'; issues.push('Mandatory fields are not named'); }
      return { ...a, storyKey: s.key, ...c, messages: quoted(a.text), entities: mentions(a.text), testability, issues };
    });
    if (!s.ac.length) findings.push({ level: 'high', text: 'Story has no acceptance criteria' });
    if (!/^as an? /i.test(s.text || '')) findings.push({ level: 'low', text: 'Description is not in "As a … I want … so that …" form' });
    acs.filter((a) => a.testability !== 'Testable').forEach((a) => findings.push({ level: a.testability === 'Ambiguous' ? 'medium' : 'low', text: `${a.id}: ${a.testability}${a.issues.length ? ' — ' + a.issues.join('; ') : ''}` }));
    if (VAGUE.test(s.text || '')) findings.push({ level: 'low', text: `Description uses vague wording ("${(s.text.match(VAGUE) || [])[1]}")` });
    let score = 100 - (s.ac.length ? 0 : 40) - acs.filter((a) => a.testability === 'Ambiguous').length * 15
      - acs.filter((a) => ['Needs human design'].includes(a.testability)).length * 10 - (/^as an? /i.test(s.text || '') ? 0 : 5);
    score = Math.max(0, Math.min(100, score));
    const riskScore = (PRIORITY_W[s.priority] || 1) * (IMPACT[stage] || 1);
    const risk = riskScore >= 6 ? 'High' : riskScore >= 3 ? 'Medium' : 'Low';
    out.push({ key: s.key, summary: s.summary, epicKey: s.epicKey, priority: s.priority, stage, stageLabel: (STAGES.find((x) => x.id === stage) || { label: 'Unmapped' }).label, risk, riskScore, qualityScore: score, findings, acs });
    log(`${s.key} → stage "${stage}", risk ${risk}, quality ${score}/100, ${acs.length} AC (${acs.filter((a) => a.kind !== 'manual').length} automatable)`);
  }
  const all = out.flatMap((s) => s.acs);
  const unmapped = out.filter((s) => s.stage === 'unknown');
  run.analysis = {
    stories: out,
    totals: {
      stories: out.length, acs: all.length,
      testable: all.filter((a) => a.testability === 'Testable').length,
      ambiguous: all.filter((a) => a.testability === 'Ambiguous').length,
      notObservable: all.filter((a) => a.testability === 'Not UI-observable').length,
      needsDesign: all.filter((a) => a.testability === 'Needs human design').length,
      automatable: all.filter((a) => a.kind !== 'manual').length,
      avgQuality: Math.round(out.reduce((n, s) => n + s.qualityScore, 0) / (out.length || 1)),
      highRisk: out.filter((s) => s.risk === 'High').length,
    },
    journey: ['search', 'hotel', 'member', 'booking', 'find'].map((st) => ({ stage: st, label: STAGES.find((x) => x.id === st).label, stories: out.filter((s) => s.stage === st || (st === 'search' && s.stage === 'results')).map((s) => s.key) })),
    unmapped: unmapped.map((s) => s.key),
  };
  const t = run.analysis.totals;
  return `${t.acs} AC analysed · ${t.automatable} automatable · ${t.ambiguous} ambiguous · ${t.notObservable} not UI-observable`;
};
