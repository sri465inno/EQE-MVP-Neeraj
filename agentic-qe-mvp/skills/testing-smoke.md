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

A smoke run is deliberately small. Select only the critical path: the base commission of a standard reservation, a
quote that carries the full 1,000-attribute reservation, and the commission statement page.

Do not design the rest of the suite. List every other requirement as out of scope for this run, so nobody reads a
passing smoke run as a release decision.

A smoke run never replaces a functional or regression run before release.
