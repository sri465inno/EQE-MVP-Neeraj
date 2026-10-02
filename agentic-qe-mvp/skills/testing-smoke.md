---
id: testing-smoke
name: Smoke test selection
description: Steers the design and execution agents to a few critical-path checks that show the build is worth testing.
testingType: smoke
appliesTo: [testcases, scripts, execution]
delivers:
  testcases: [smokeSet]
  execution: [results]
---

A smoke run is deliberately small. Select only the critical path: a standard search, a booking built from the full
data dictionary, and one reservation through to its confirmation.

Do not design the rest of the suite. List every other requirement as out of scope for this run, so nobody reads a
passing smoke run as a release decision.

A smoke run never replaces a functional or regression run before release.
