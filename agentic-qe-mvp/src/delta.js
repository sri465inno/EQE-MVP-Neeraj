'use strict';
// Delta classification of incoming (reviewed) statements against an approved baseline.
const { describe, jaccard, SAME_SUBJECT_THRESHOLD } = require('./text');

/**
 * unchanged - same subject, same values as a baseline requirement
 * enhanced  - same subject, different detail: new value wins, old value is kept
 * new       - no baseline requirement covers the subject
 */
function classifyDelta(baselineRequirements, incoming) {
  const base = baselineRequirements.map((r) => ({ r, d: describe(r.text) }));
  const items = incoming.map((inc) => {
    const d = describe(inc.text);
    let best = null;
    let bestScore = 0;
    for (const b of base) {
      const score = jaccard(d.tokens, b.d.tokens);
      if (score > bestScore) { best = b; bestScore = score; }
    }
    if (!best || bestScore < SAME_SUBJECT_THRESHOLD) {
      return { classification: 'new', incoming: inc, baselineRequirementId: null, similarity: Number(bestScore.toFixed(2)) };
    }
    const same = d.signature === best.d.signature;
    return {
      classification: same ? 'unchanged' : 'enhanced',
      incoming: inc,
      baselineRequirementId: best.r.id,
      similarity: Number(bestScore.toFixed(2)),
      previous: same ? null : { text: best.r.text, values: best.r.values, version: best.r.version },
      matched: same ? { text: best.r.text, version: best.r.version } : null,
    };
  });
  const counts = { unchanged: 0, enhanced: 0, new: 0 };
  items.forEach((i) => { counts[i.classification] += 1; });
  return { items, counts, summary: `${counts.unchanged} unchanged · ${counts.enhanced} enhanced · ${counts.new} new` };
}

module.exports = { classifyDelta };
