---
id: testing-performance
name: Performance targets
description: Steers the design and execution agents to measure the response-time targets stated in the inputs.
testingType: performance
appliesTo: [testcases, scripts, execution]
delivers:
  testcases: [performanceChecks]
  execution: [timings]
---

Only measure targets the inputs state (for example "p95 within 300 ms"). Never invent a target: if the inputs state
none, report the gap and name the input that should carry it.

For each target design two checks: the latency of one advisor quoting a full reservation repeatedly, and the same
target with several advisors quoting at once.

Attach the raw timing samples to every result so the numbers can be checked.
