'use strict';
// Deterministic text utilities: value extraction, subject tokens, similarity.

const VALUE_PATTERNS = [
  { re: /\bHTTP\s*(\d{3})\b/gi, unit: 'http' },
  { re: /(\d+(?:\.\d+)?)\s*(?:%|percent\b)/gi, unit: '%' },
  { re: /(\d+(?:\.\d+)?)\s*(?:ms|milliseconds?)\b/gi, unit: 'ms' },
  { re: /(\d+(?:\.\d+)?)(?:st|nd|rd|th)\s+percentile\b/gi, unit: 'percentile' },
  { re: /(\d+(?:\.\d+)?)\s*(?:business\s+)?days?\b/gi, unit: 'days' },
  { re: /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/gi, unit: 'hours' },
  { re: /(\d+(?:\.\d+)?)\s*decimal\s+places?\b/gi, unit: 'decimal places' },
  { re: /\bUSD\s*(\d+(?:\.\d+)?)/gi, unit: 'USD' },
  { re: /(\d+)\s*nights?\b/gi, unit: 'nights' },
  { re: /(\d+)\s+(?:or more\s+)?rooms?\b/gi, unit: 'rooms' },
  { re: /(\d+(?:\.\d+)?)/g, unit: '' },
];

const STOPWORDS = new Set(('a an the is are be been being of to in into for and or at within must should shall will can may '
  + 'every each all with by on per from its it their this that as than when which who any has have had do does '
  + 'http percent ms millisecond milliseconds percentile day days business hour hours hr hrs decimal place places more').split(' '));

function extractValues(text) {
  let rest = String(text);
  const values = [];
  for (const { re, unit } of VALUE_PATTERNS) {
    rest = rest.replace(re, (m, num) => {
      values.push({ num: Number(num), unit, raw: m.trim() });
      return ' ';
    });
  }
  return { values, rest };
}

function valueSignature(values) {
  return values.map((v) => `${v.num}${v.unit ? ' ' + v.unit : ''}`).sort().join(' | ');
}

function stem(w) {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

function subjectTokens(text) {
  const { rest } = extractValues(text);
  return [...new Set(rest.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ')
    .filter((w) => w && !STOPWORDS.has(w)).map(stem))].sort();
}

function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  return inter / (A.size + B.size - inter);
}

const SAME_SUBJECT_THRESHOLD = 0.7;

function similarity(textA, textB) {
  return jaccard(subjectTokens(textA), subjectTokens(textB));
}

function describe(text) {
  const { values } = extractValues(text);
  return { tokens: subjectTokens(text), values, signature: valueSignature(values) };
}

module.exports = { extractValues, valueSignature, subjectTokens, jaccard, similarity, describe, SAME_SUBJECT_THRESHOLD };
