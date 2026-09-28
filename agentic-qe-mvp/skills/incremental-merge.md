---
id: incremental-merge
name: Incremental load and merge rules
description: How an addition is classified against the baseline and what a human must see before it merges.
appliesTo: [delta, rules, testcases, scripts]
delivers:
  delta: [delta]
  rules: [businessRules]
  testcases: [functional, nonFunctional]
  scripts: [specs]
---

Every statement in an added input is classified against the approved baseline as exactly one of:

- unchanged — the baseline already says this, same subject and same detail: nothing is re-designed, the
  existing artefacts are carried over untouched;
- enhanced — same subject, different detail: the new value wins, the baseline value is kept beside it as the
  superseded one, and only that rule and the cases and specs hanging off it are re-designed;
- new — no baseline subject matches: designed from scratch.

A subject is matched on meaning, not on wording: re-supplying the same document must land almost entirely in
"unchanged" and cost nothing.

An enhanced value is propagated all the way down in the same cycle: the rule, every case that verifies it, and
every generated assertion must state the new value. A case still stating the old value is a failed hand-over,
not a reuse.

Nothing merges into the baseline until a human approves. The review screen shows only what is new and what was
re-designed, with each superseded value beside its replacement, and lets the reviewer edit or reject any row.

Rejecting leaves the approved baseline exactly as it was; the addition is discarded, not partially applied.

Ids are stable across the merge: a re-designed artefact keeps its id and records what it superseded.
