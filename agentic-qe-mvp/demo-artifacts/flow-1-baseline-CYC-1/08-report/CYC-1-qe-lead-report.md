# QE lead report - Commission baseline

CYC-1 · baseline cycle

> **Recommendation: No-go.** 1 release-blocking defect open (DEF-001).

| Requirements | Test cases | Automated | Pass rate | Defects | Requirements verified |
|---|---|---|---|---|---|
| 14 | 15 | 14 | 92.9% | 1 | 85.7% |

## 1. Summary
- Baseline cycle for Travel-advisor commission calculated from reservation attributes on build demo/commission-engine, 2026-09-28 21:43 UTC.
- We took 3 inputs (Jira initiative COM-1, Jira epic COM-10, Codebase sri465inno/uc-agentic-quality-engineering@demo/commission-engine (df5203e)) and produced 14 requirements, 15 test cases and 13 automated scripts.
- We ran 14 automated tests for real: 13 passed, 1 failed (pass rate 92.9%). 1 manual test still to be run by hand.
- 1 defect raised from real failures, 1 release-blocking: DEF-001 A stay of exactly 7 nights earns the 1.5% long-stay bonus: returns 80 instead of 92.

## 2. Inputs taken
| Input | Reference | What we took from it | Source |
|---|---|---|---|
| Jira initiative | COM-1 | Travel-advisor commission platform; 3 statements | pulled from GitHub |
| Jira epic | COM-10 | Commission calculation for transient reservations; 8 statements | pulled from GitHub |
| Codebase | sri465inno/uc-agentic-quality-engineering@demo/commission-engine (df5203e) | Travel-advisor commission engine for Aurora Hotels reservations (sample codebase for the Agentic QE Platform - MVP demo); 16 statements | pulled from GitHub |

## 3. How we ran the cycle
1. Read 27 statements from the inputs and lined them up into 14 requirement groups: 7 agreed by every source, 3 only in Jira, 3 only in the code, 1 in conflict.
2. Priya Shah reviewed and approved the requirement set on 2026-09-28 21:43 UTC, settling 1 conflict: GDS channel uplift - kept "Reservations booked through the GDS channel earn an additional 1.5% channel uplift." (code) over "Reservations booked through the GDS channel earn an additional 2% channel uplift." (jira).
3. Derived 14 business rules (each quoting its source), designed 15 test cases (14 functional, 1 non-functional) and generated 13 Playwright scripts.
4. Executed the automated suite with Playwright 1.63.0 (headless Chromium, JSON reporter) against Aurora commission engine, bundled copy of branch demo/commission-engine (samples/commission-engine/baseline); defects were raised only for tests that actually failed.

## 4. Artifacts produced
| Artifact | Count | Notes | Folder |
|---|---|---|---|
| Inputs and provenance | 3 | what was taken from each source, and where from | [01-inputs/](01-inputs/) |
| Normalised requirement set | 14 | 7 agreed · 3 Jira-only · 3 code-only · 1 conflicts | [01-inputs/normalisation.json](01-inputs/normalisation.json) |
| Requirements repository | 14 | 14 new | [02-requirements/](02-requirements/) |
| Business rules | 14 | 13 executable, each with a source quote | [03-business-rules/](03-business-rules/) |
| Test cases (Excel, Zephyr Scale format) | 15 | 14 automated · 1 not automated | [04-test-cases/](04-test-cases/) |
| Automation scripts (Playwright) | 13 | 13 new | [05-automation-scripts/](05-automation-scripts/) |
| Execution results and evidence | 14 | 13 passed · 1 failed · 1 manual | [06-execution/](06-execution/) |
| Defects | 1 | DEF-001 Critical | [07-defects/](07-defects/) |
| Cycle report (HTML, Excel) | 1 | full detail behind this summary | [08-report/](08-report/) |

## 5. Risks and open items
- DEF-001 (Critical): money moved wrongly. Expected 92, got 80. Blocks the release: money moved wrongly (BR-007).
- 1 test case cannot be automated and was not executed: TC-F-012 Verify: Every commission calculation is written to the commission audit ledger. Needs a manual run before sign-off.
- 2 requirements not yet verified by a passing test: REQ-007 (executed - failing); REQ-012 (designed only (manual)).
- 1 conflict between Jira and the code was settled by the reviewer; the losing source (jira) should be corrected so they agree.
- 6 requirement groups come from a single source only; the product owner should confirm them.

_9 of 11 commission-driving attributes (out of 1000 reservation attributes) are varied by at least one test._

## 6. Recommendation and next steps
**No-go.** 1 release-blocking defect open (DEF-001).

- Fix DEF-001 and re-run TC-F-006; it must pass before release.
- Run TC-F-012 manually and record the result.
- Update the losing source (Jira or code) so both state the reviewed value.
- Use this approved baseline as the reference for the next incremental cycle.

## 7. Sign-off
| Gate | Decision | By | When | Detail |
|---|---|---|---|---|
| Requirement set review | approved | Priya Shah | 2026-09-28 21:43 UTC | 14 requirements approved; 0 excluded; 1 conflict(s) resolved |

_Agentic QE Platform (QE lead report, computed from the cycle) · generated 2026-09-28 21:43 UTC. Every figure comes from the persisted cycle; nothing is estimated._
