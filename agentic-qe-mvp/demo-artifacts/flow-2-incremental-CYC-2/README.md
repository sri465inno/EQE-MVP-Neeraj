# CYC-2 - Commission increment (COM-20, engine 2.0)

Type: **incremental** · Status: **completed** · Completed: 2026-09-28T21:39:44.781Z

## Inputs
| Input | Reference | Provenance |
|---|---|---|
| Jira epic | COM-20 | Jira REST API v3 export pulled live from GitHub (sri465inno/uc-agentic-quality-engineering@demo/jira-export) - synthetic test issues; no live Jira call was made |
| Codebase | sri465inno/uc-agentic-quality-engineering@demo/commission-engine-v2 (6ccd807) | Pulled live from GitHub: git clone of sri465inno/uc-agentic-quality-engineering@demo/commission-engine-v2 (6ccd807) at 2026-09-28T21:39:41.708Z |

## Delta against the baseline
10 unchanged · 1 enhanced · 3 new

## Requirements (17)
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

## Test cases (19)
| Key | Name | Type | Automation | Status |
|---|---|---|---|---|
| TC-F-001 | The reservation model has 1000 attributes and a full reservation is accepted | functional | Automated | carried over |
| TC-F-002 | Advisor views the commission breakdown on the commission statement page | functional | Automated | carried over |
| TC-N-001 | Commission quote p95 response time is within 300 ms | non-functional | Automated | carried over |
| TC-F-003 | Base commission is 10% of commissionable room revenue | functional | Automated | carried over |
| TC-F-004 | Taxes, resort fees and ancillaries are excluded from commissionable revenue | functional | Automated | carried over |
| TC-F-005 | GDS reservations earn an additional 1.5% channel uplift | functional | Automated | carried over |
| TC-F-006 | A stay of exactly 7 nights earns the 1.5% long-stay bonus | functional | Automated | carried over |
| TC-F-007 | A stay of 6 nights earns no long-stay bonus | functional | Automated | carried over |
| TC-F-008 | Commission is capped at USD 750 per reservation | functional | Automated | re-designed |
| TC-F-009 | Commission is rounded half-up to 2 decimal places | functional | Automated | carried over |
| TC-F-010 | A stay paid with loyalty points earns no commission | functional | Automated | carried over |
| TC-F-011 | Cancelled and no-show reservations earn no commission | functional | Automated | carried over |
| TC-F-012 | Verify: Every commission calculation is written to the commission audit ledger | functional | Not automated | carried over |
| TC-F-013 | A reservation without an advisor IATA number returns HTTP 422 | functional | Automated | carried over |
| TC-F-014 | Commission for an unknown reservation ID returns HTTP 404 | functional | Automated | carried over |
| TC-F-015 | A group of 10 rooms is commissioned at a flat 8% | functional | Automated | new |
| TC-F-016 | 9 rooms keep the transient base rate | functional | Automated | new |
| TC-F-017 | Package rates are commissioned on 70% of the package price | functional | Automated | new |
| TC-F-018 | Negotiated corporate rates are commissioned at a flat 5% | functional | Automated | new |

## Execution (real Playwright run)
18 executed · 17 passed · 1 failed · 1 not run · pass rate 94.4%

| Key | Test | Result | ms |
|---|---|---|---|
| TC-F-001 | The reservation model has 1000 attributes and a full reservation is accepted | passed | 30 |
| TC-F-002 | Advisor views the commission breakdown on the commission statement page | passed | 224 |
| TC-N-001 | Commission quote p95 response time is within 300 ms | passed | 56 |
| TC-F-003 | Base commission is 10% of commissionable room revenue | passed | 10 |
| TC-F-004 | Taxes, resort fees and ancillaries are excluded from commissionable revenue | passed | 8 |
| TC-F-005 | GDS reservations earn an additional 1.5% channel uplift | passed | 7 |
| TC-F-006 | A stay of exactly 7 nights earns the 1.5% long-stay bonus | failed | 8 |
| TC-F-007 | A stay of 6 nights earns no long-stay bonus | passed | 27 |
| TC-F-008 | Commission is capped at USD 750 per reservation | passed | 10 |
| TC-F-009 | Commission is rounded half-up to 2 decimal places | passed | 9 |
| TC-F-010 | A stay paid with loyalty points earns no commission | passed | 13 |
| TC-F-011 | Cancelled and no-show reservations earn no commission | passed | 11 |
| TC-F-012 | Verify: Every commission calculation is written to the commission audit ledger | not-run | 0 |
| TC-F-013 | A reservation without an advisor IATA number returns HTTP 422 | passed | 11 |
| TC-F-014 | Commission for an unknown reservation ID returns HTTP 404 | passed | 3 |
| TC-F-015 | A group of 10 rooms is commissioned at a flat 8% | passed | 8 |
| TC-F-016 | 9 rooms keep the transient base rate | passed | 5 |
| TC-F-017 | Package rates are commissioned on 70% of the package price | passed | 9 |
| TC-F-018 | Negotiated corporate rates are commissioned at a flat 5% | passed | 7 |

## Defects (1)
| ID | Title | Severity | Expected | Actual | Test case |
|---|---|---|---|---|---|
| DEF-001 | A stay of exactly 7 nights earns the 1.5% long-stay bonus: returns 80 instead of 92 | Critical | 92 | 80 | TC-F-006 |

## Approvals
| Gate | Decision | By | When |
|---|---|---|---|
| Requirement set review | approved | Priya Shah | 2026-09-28T21:39:43.429Z |
| Merge into baseline | approved | Sam Lee | 2026-09-28T21:39:43.437Z |
