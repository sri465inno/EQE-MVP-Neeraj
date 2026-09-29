---
id: testing-regression
name: Regression pack
description: Steers the design and execution agents to keep and re-run the full pack so nothing that worked before breaks.
testingType: regression
appliesTo: [testcases, scripts, execution]
delivers:
  testcases: [regressionPack]
  execution: [results]
---

The regression pack is every functional, screen and non-functional case the baseline holds. In a baseline run there
is no earlier pack, so the full pack is designed from the inputs.

In an incremental run, re-run every carried-over case alongside the new and re-designed ones, including journeys or
load checks that an earlier end-to-end or performance run added to the baseline. Label carried-over cases
"regression".

Report how many cases were reused unchanged and how many were re-designed, so the release manager sees the reuse.
