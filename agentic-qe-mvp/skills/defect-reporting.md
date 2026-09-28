---
id: defect-reporting
name: Defect reporting
description: What a defect must contain before it is raised, so every cycle's defects read the same and are actionable.
appliesTo: [defects]
delivers:
  defects: [defects]
---

A defect is raised only for a test case that actually failed in this cycle's execution. A designed-but-not-run
case, a quarantined case, or a suspicion is never a defect — it is a gap or a risk.

Every defect carries: a DEF-### id, the failing test case id, the business rule id through that case, the
source issue or repository path behind the rule, expected value, actual value, the failing assertion text, the
spec file, the run timestamp, and the suspected code area.

Title states the behaviour that is wrong, with the values: "Electronics restocking fee returns 37.49 instead of
37.50 (half-up rounding)".

Severity is set from business impact, not from how the test failed: Critical for money moved wrongly, data loss
or a security hole; High for a blocked core journey; Medium for a wrong value with a workaround; Low for
cosmetic or advisory issues.

Say plainly whether the defect blocks the release, and why.

A defect that reappears in a later cycle keeps its original id and gains the new cycle's evidence; it is never
re-raised under a new number.

A defect that is not reproducible in this run's evidence is not raised.
