---
id: traceability-handover
name: Traceability hand-over
description: What each phase owes the next one so the chain from input to defect never breaks in any cycle.
appliesTo: [normalise, requirements, testcases, testdata, scripts, execution, defects, report]
delivers:
  normalise: [statements]
  requirements: [requirements, businessRules]
  testcases: [functional, nonFunctional]
  testdata: [dataSets]
  scripts: [specs]
  execution: [results]
  defects: [defects]
  report: [cycleReport]
---

The chain is source → statement → business rule → test case → automation spec → execution result → defect →
cycle report. Every artefact names its parent by id; an artefact with no parent is not produced.

Every business rule carries a BR-### id and quotes the source sentence and the issue key or file it came from.

Every test case names the brId it verifies. Every spec names the rule and the case ids it covers.

Every execution result is scored against the rule its own case proves — never against the first rule in the
spec file when a file covers several cases.

Every defect names the failing case and, through it, the rule at risk.

The cycle report can walk the chain in both directions for any id, and says so for every rule that has no
case, every case with no spec, and every spec with no result.

A phase that cannot fill one of these hands over the gap explicitly instead of inventing a link.
