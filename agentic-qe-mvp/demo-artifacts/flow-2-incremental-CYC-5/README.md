# QE lead report - Commission increment (COM-20, engine 2.0)

CYC-5 · incremental cycle

> **Recommendation: No-go.** 1 release-blocking defect open (DEF-001).

| Type of testing | Requirements | Test cases | Automated | Pass rate | Defects | Requirements verified |
|---|---|---|---|---|---|---|
| Regression testing | 17 | 19 | 18 | 94.4% | 1 | 88.2% |

## 1. Summary
- Incremental cycle for Travel-advisor commission calculated from reservation attributes on build demo/commission-engine-v2, 2026-10-02 04:13 UTC.
- Type of testing: Regression testing. The full pack: every functional, screen and non-functional case, so nothing that worked before has broken.
- We took 2 inputs (Jira epic COM-20, Codebase sri465inno/uc-agentic-quality-engineering@demo/commission-engine-v2 (6ccd807)) and produced 17 requirements, 19 test cases and 16 automated scripts.
- We ran 18 automated tests for real: 17 passed, 1 failed (pass rate 94.4%). 1 manual test still to be run by hand.
- 1 defect raised from real failures, 1 release-blocking: DEF-001 A stay of exactly 7 nights earns the 1.5% long-stay bonus: returns 80 instead of 92.
- Against the baseline: 10 unchanged · 1 enhanced · 3 new. 14 of 19 test cases were reused unchanged; only new and changed items were redesigned.

## 2. Inputs taken
| Input | Reference | What we took from it | Source |
|---|---|---|---|
| Jira epic | COM-20 | Group and package reservation commission; 3 statements | pulled from GitHub |
| Codebase | sri465inno/uc-agentic-quality-engineering@demo/commission-engine-v2 (6ccd807) | Travel-advisor commission engine for Aurora Hotels reservations (sample codebase for the Agentic QE Platform - MVP demo); 20 statements | pulled from GitHub |

## 3. How we ran the cycle
1. Read 23 statements from the inputs and lined them up into 14 requirement groups: 2 agreed by every source, 1 only in Jira, 11 only in the code, 0 in conflict.
2. The review agent read the inputs first and suggested 15 addition(s), 3 missing piece(s) and 0 conflict(s) for the reviewer (8 high severity). It approved nothing.
3. Priya Shah reviewed and approved the requirement set on 2026-10-02 04:13 UTC.
4. Compared every statement with baseline BL-4 v1: 10 unchanged · 1 enhanced · 3 new. Changed: REQ-008 "Commission per reservation is capped at USD 500." → "Commission per reservation is capped at USD 750.".
5. Regression testing steered the design: Re-runs every case carried over from the baseline alongside the new and re-designed ones. Result: 19 case(s) in this run (14 reused, 1 re-designed, 4 new).
6. Derived 17 business rules (each quoting its source), designed 19 test cases (18 functional, 1 non-functional) and generated 16 Playwright scripts.
7. Sam Lee approved the merge into the baseline on 2026-10-02 04:13 UTC.
8. Executed the automated suite with Playwright 1.63.0 (headless Chromium, JSON reporter) against Aurora commission engine, bundled copy of branch demo/commission-engine-v2 (samples/commission-engine/v2); defects were raised only for tests that actually failed.

## 4. Artifacts produced
| Artifact | Count | Notes | Folder |
|---|---|---|---|
| Inputs and provenance | 2 | what was taken from each source, and where from | [01-inputs/](01-inputs/) |
| Review agent suggestions | 18 | 15 added · 3 missing · 0 conflicts (advisory) | [01-inputs/review-agent.json](01-inputs/review-agent.json) |
| Normalised requirement set | 14 | 2 agreed · 1 Jira-only · 11 code-only · 0 conflicts | [01-inputs/normalisation.json](01-inputs/normalisation.json) |
| Delta against baseline | 14 | 10 unchanged · 1 enhanced · 3 new | [01-inputs/delta-classification.json](01-inputs/delta-classification.json) |
| Requirements repository | 17 | 10 unchanged · 3 carried over · 1 enhanced · 3 new | [02-requirements/](02-requirements/) |
| Business rules | 17 | 16 executable, each with a source quote | [03-business-rules/](03-business-rules/) |
| Test cases (Excel, Zephyr Scale format) | 19 | 18 automated · 1 not automated | [04-test-cases/](04-test-cases/) |
| Test data (one data set per test case) | 19 | 18 conform to Reservation v2026.3 (1000 attributes) · 1 negative test | [05-test-data/](05-test-data/) |
| Automation scripts (Playwright) | 16 | 12 carried over · 1 re-designed · 3 new | [06-automation-scripts/](06-automation-scripts/) |
| Merge approval | 1 | approved by Sam Lee | [10-merge-approval/](10-merge-approval/) |
| Execution results and evidence | 18 | 17 passed · 1 failed · 1 manual | [07-execution/](07-execution/) |
| Defects | 1 | DEF-001 Critical | [08-defects/](08-defects/) |
| Cycle report (HTML, Excel) | 1 | full detail behind this summary | [09-report/](09-report/) |

## 5. Risks and open items
- Review agent (RA-12): Asked for in Jira but not mentioned in the code. Tests are designed from the Jira wording; expect them to fail until it is built, or confirm with the developers where it lives.
- DEF-001 (Critical): money moved wrongly. Expected 92, got 80. Blocks the release: money moved wrongly (BR-007).
- 1 test case cannot be automated and was not executed: TC-F-012 Verify: Every commission calculation is written to the commission audit ledger. Needs a manual run before sign-off.
- 2 requirements not yet verified by a passing test: REQ-007 (executed - failing); REQ-012 (designed only (manual)).
- 12 requirement groups come from a single source only; the product owner should confirm them.

_11 of 11 commission-driving attributes (out of 1000 reservation attributes) are varied by at least one test._

## 6. Recommendation and next steps
**No-go.** 1 release-blocking defect open (DEF-001).

- Fix DEF-001 and re-run TC-F-006; it must pass before release.
- Run TC-F-012 manually and record the result.
- Keep the updated baseline as the reference for the next release.

## 7. Sign-off
| Gate | Decision | By | When | Detail |
|---|---|---|---|---|
| Requirement set review | approved | Priya Shah | 2026-10-02 04:13 UTC | 14 requirements approved; 0 excluded; 0 conflict(s) resolved |
| Merge into baseline | approved | Sam Lee | 2026-10-02 04:13 UTC | 4 requirements, 5 test cases, 4 scripts merged: BL-4 v1 -> v2 |

_Agentic QE Platform (QE lead report, computed from the cycle) · generated 2026-10-02 04:13 UTC. Every figure comes from the persisted cycle; nothing is estimated._

## Appendix A: test results (real Playwright run)
| Key | Test | Result | ms |
|---|---|---|---|
| TC-F-001 | The reservation model has 1000 attributes and a full reservation is accepted | passed | 27 |
| TC-F-002 | Advisor views the commission breakdown on the commission statement page | passed | 227 |
| TC-N-001 | Commission quote p95 response time is within 300 ms | passed | 51 |
| TC-F-003 | Base commission is 10% of commissionable room revenue | passed | 9 |
| TC-F-004 | Taxes, resort fees and ancillaries are excluded from commissionable revenue | passed | 6 |
| TC-F-005 | GDS reservations earn an additional 1.5% channel uplift | passed | 9 |
| TC-F-006 | A stay of exactly 7 nights earns the 1.5% long-stay bonus | failed | 6 |
| TC-F-007 | A stay of 6 nights earns no long-stay bonus | passed | 22 |
| TC-F-008 | Commission is capped at USD 750 per reservation | passed | 11 |
| TC-F-009 | Commission is rounded half-up to 2 decimal places | passed | 10 |
| TC-F-010 | A stay paid with loyalty points earns no commission | passed | 9 |
| TC-F-011 | Cancelled and no-show reservations earn no commission | passed | 9 |
| TC-F-012 | Verify: Every commission calculation is written to the commission audit ledger | not-run | 0 |
| TC-F-013 | A reservation without an advisor IATA number returns HTTP 422 | passed | 11 |
| TC-F-014 | Commission for an unknown reservation ID returns HTTP 404 | passed | 3 |
| TC-F-015 | A group of 10 rooms is commissioned at a flat 8% | passed | 6 |
| TC-F-016 | 9 rooms keep the transient base rate | passed | 6 |
| TC-F-017 | Package rates are commissioned on 70% of the package price | passed | 6 |
| TC-F-018 | Negotiated corporate rates are commissioned at a flat 5% | passed | 5 |

## Appendix B: requirements
| ID | Requirement | Status |
|---|---|---|
| REQ-001 | Every reservation is described by a data dictionary of 1000 attributes. | unchanged |
| REQ-002 | Travel advisors can view the commission breakdown for a reservation online. | carried over |
| REQ-003 | Commission quotes return within 300 ms at the 95th percentile. | carried over |
| REQ-004 | Base commission is 10% of commissionable room revenue. | unchanged |
| REQ-005 | Commissionable room revenue excludes taxes, resort fees and ancillary charges. | unchanged |
| REQ-006 | Reservations booked through the GDS channel earn an additional 1.5% channel uplift. | unchanged |
| REQ-007 | Stays of 7 nights or more earn a long-stay bonus of 1.5%. | unchanged |
| REQ-008 | Commission per reservation is capped at USD 750. | enhanced |
| REQ-009 | Commission is rounded half-up to 2 decimal places. | unchanged |
| REQ-010 | Reservations paid with loyalty points are not commissionable. | unchanged |
| REQ-011 | Cancelled and no-show reservations earn no commission. | carried over |
| REQ-012 | Every commission calculation is written to the commission audit ledger. | unchanged |
| REQ-013 | A reservation without an advisor IATA number returns HTTP 422. | unchanged |
| REQ-014 | Unknown reservation IDs return HTTP 404. | unchanged |
| REQ-015 | Group reservations of 10 or more rooms are commissioned at a flat 8%. | new |
| REQ-016 | Package rates are commissioned on 70% of the package price. | new |
| REQ-017 | Negotiated corporate rates (rate plan CORP) are commissioned at a flat 5%. | new |
