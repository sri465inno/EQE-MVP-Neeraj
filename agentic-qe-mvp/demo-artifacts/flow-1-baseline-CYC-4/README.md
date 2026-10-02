# QE lead report - Commission baseline

CYC-4 · baseline cycle

> **Recommendation: No-go.** 1 release-blocking defect open (DEF-001).

| Type of testing | Requirements | Test cases | Automated | Pass rate | Defects | Requirements verified |
|---|---|---|---|---|---|---|
| Regression testing | 14 | 15 | 14 | 92.9% | 1 | 85.7% |

## 1. Summary
- Baseline cycle for Travel-advisor commission calculated from reservation attributes on build demo/commission-engine, 2026-10-02 03:54 UTC.
- Type of testing: Regression testing. The full pack: every functional, screen and non-functional case, so nothing that worked before has broken.
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
2. The review agent read the inputs first and suggested 3 addition(s), 5 missing piece(s) and 1 conflict(s) for the reviewer (2 high severity). It approved nothing.
3. Priya Shah reviewed and approved the requirement set on 2026-10-02 03:54 UTC, settling 1 conflict: GDS channel uplift - kept "Reservations booked through the GDS channel earn an additional 1.5% channel uplift." (code) over "Reservations booked through the GDS channel earn an additional 2% channel uplift." (jira).
4. Regression testing steered the design: No earlier pack exists, so it designs the full regression pack (functional, screen and non-functional) and runs it. Result: 15 case(s) in this run (0 reused, 0 re-designed, 15 new).
5. Derived 14 business rules (each quoting its source), designed 15 test cases (14 functional, 1 non-functional) and generated 13 Playwright scripts.
6. Executed the automated suite with Playwright 1.63.0 (headless Chromium, JSON reporter) against Aurora commission engine, bundled copy of branch demo/commission-engine (samples/commission-engine/baseline); defects were raised only for tests that actually failed.

## 4. Artifacts produced
| Artifact | Count | Notes | Folder |
|---|---|---|---|
| Inputs and provenance | 3 | what was taken from each source, and where from | [01-inputs/](01-inputs/) |
| Review agent suggestions | 9 | 3 added · 5 missing · 1 conflicts (advisory) | [01-inputs/review-agent.json](01-inputs/review-agent.json) |
| Normalised requirement set | 14 | 7 agreed · 3 Jira-only · 3 code-only · 1 conflicts | [01-inputs/normalisation.json](01-inputs/normalisation.json) |
| Requirements repository | 14 | 14 new | [02-requirements/](02-requirements/) |
| Business rules | 14 | 13 executable, each with a source quote | [03-business-rules/](03-business-rules/) |
| Test cases (Excel, Zephyr Scale format) | 15 | 14 automated · 1 not automated | [04-test-cases/](04-test-cases/) |
| Test data (one data set per test case) | 15 | 14 conform to Reservation v2026.3 (1000 attributes) · 1 negative test | [05-test-data/](05-test-data/) |
| Automation scripts (Playwright) | 13 | 13 new | [06-automation-scripts/](06-automation-scripts/) |
| Execution results and evidence | 14 | 13 passed · 1 failed · 1 manual | [07-execution/](07-execution/) |
| Defects | 1 | DEF-001 Critical | [08-defects/](08-defects/) |
| Cycle report (HTML, Excel) | 1 | full detail behind this summary | [09-report/](09-report/) |

## 5. Risks and open items
- Review agent (RA-07): Asked for in Jira but not mentioned in the code. Tests are designed from the Jira wording; expect them to fail until it is built, or confirm with the developers where it lives.
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
| Requirement set review | approved | Priya Shah | 2026-10-02 03:54 UTC | 14 requirements approved; 0 excluded; 1 conflict(s) resolved |

_Agentic QE Platform (QE lead report, computed from the cycle) · generated 2026-10-02 03:54 UTC. Every figure comes from the persisted cycle; nothing is estimated._

## Appendix A: test results (real Playwright run)
| Key | Test | Result | ms |
|---|---|---|---|
| TC-F-001 | The reservation model has 1000 attributes and a full reservation is accepted | passed | 37 |
| TC-F-002 | Advisor views the commission breakdown on the commission statement page | passed | 226 |
| TC-N-001 | Commission quote p95 response time is within 300 ms | passed | 51 |
| TC-F-003 | Base commission is 10% of commissionable room revenue | passed | 8 |
| TC-F-004 | Taxes, resort fees and ancillaries are excluded from commissionable revenue | passed | 6 |
| TC-F-005 | GDS reservations earn an additional 1.5% channel uplift | passed | 9 |
| TC-F-006 | A stay of exactly 7 nights earns the 1.5% long-stay bonus | failed | 6 |
| TC-F-007 | A stay of 6 nights earns no long-stay bonus | passed | 22 |
| TC-F-008 | Commission is capped at USD 500 per reservation | passed | 8 |
| TC-F-009 | Commission is rounded half-up to 2 decimal places | passed | 12 |
| TC-F-010 | A stay paid with loyalty points earns no commission | passed | 7 |
| TC-F-011 | Cancelled and no-show reservations earn no commission | passed | 10 |
| TC-F-012 | Verify: Every commission calculation is written to the commission audit ledger | not-run | 0 |
| TC-F-013 | A reservation without an advisor IATA number returns HTTP 422 | passed | 7 |
| TC-F-014 | Commission for an unknown reservation ID returns HTTP 404 | passed | 4 |

## Appendix B: requirements
| ID | Requirement | Status |
|---|---|---|
| REQ-001 | Every reservation is described by a data dictionary of 1000 attributes. | new |
| REQ-002 | Travel advisors can view the commission breakdown for a reservation online. | new |
| REQ-003 | Commission quotes return within 300 ms at the 95th percentile. | new |
| REQ-004 | Base commission is 10% of commissionable room revenue. | new |
| REQ-005 | Commissionable room revenue excludes taxes, resort fees and ancillary charges. | new |
| REQ-006 | Reservations booked through the GDS channel earn an additional 1.5% channel uplift. | new |
| REQ-007 | Stays of 7 nights or more earn a long-stay bonus of 1.5%. | new |
| REQ-008 | Commission per reservation is capped at USD 500. | new |
| REQ-009 | Commission is rounded half-up to 2 decimal places. | new |
| REQ-010 | Reservations paid with loyalty points are not commissionable. | new |
| REQ-011 | Cancelled and no-show reservations earn no commission. | new |
| REQ-012 | Every commission calculation is written to the commission audit ledger. | new |
| REQ-013 | A reservation without an advisor IATA number returns HTTP 422. | new |
| REQ-014 | Unknown reservation IDs return HTTP 404. | new |
