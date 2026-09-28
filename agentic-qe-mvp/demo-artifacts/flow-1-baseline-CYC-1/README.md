# CYC-1 - Commission baseline

Type: **baseline** · Status: **completed** · Completed: 2026-09-28T21:39:41.482Z

## Inputs
| Input | Reference | Provenance |
|---|---|---|
| Jira initiative | COM-1 | Jira REST API v3 export pulled live from GitHub (sri465inno/uc-agentic-quality-engineering@demo/jira-export) - synthetic test issues; no live Jira call was made |
| Jira epic | COM-10 | Jira REST API v3 export pulled live from GitHub (sri465inno/uc-agentic-quality-engineering@demo/jira-export) - synthetic test issues; no live Jira call was made |
| Codebase | sri465inno/uc-agentic-quality-engineering@demo/commission-engine (df5203e) | Pulled live from GitHub: git clone of sri465inno/uc-agentic-quality-engineering@demo/commission-engine (df5203e) at 2026-09-28T21:39:39.079Z |


## Requirements (14)
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

## Test cases (15)
| Key | Name | Type | Automation | Status |
|---|---|---|---|---|
| TC-F-001 | The reservation model has 1000 attributes and a full reservation is accepted | functional | Automated | new |
| TC-F-002 | Advisor views the commission breakdown on the commission statement page | functional | Automated | new |
| TC-N-001 | Commission quote p95 response time is within 300 ms | non-functional | Automated | new |
| TC-F-003 | Base commission is 10% of commissionable room revenue | functional | Automated | new |
| TC-F-004 | Taxes, resort fees and ancillaries are excluded from commissionable revenue | functional | Automated | new |
| TC-F-005 | GDS reservations earn an additional 1.5% channel uplift | functional | Automated | new |
| TC-F-006 | A stay of exactly 7 nights earns the 1.5% long-stay bonus | functional | Automated | new |
| TC-F-007 | A stay of 6 nights earns no long-stay bonus | functional | Automated | new |
| TC-F-008 | Commission is capped at USD 500 per reservation | functional | Automated | new |
| TC-F-009 | Commission is rounded half-up to 2 decimal places | functional | Automated | new |
| TC-F-010 | A stay paid with loyalty points earns no commission | functional | Automated | new |
| TC-F-011 | Cancelled and no-show reservations earn no commission | functional | Automated | new |
| TC-F-012 | Verify: Every commission calculation is written to the commission audit ledger | functional | Not automated | new |
| TC-F-013 | A reservation without an advisor IATA number returns HTTP 422 | functional | Automated | new |
| TC-F-014 | Commission for an unknown reservation ID returns HTTP 404 | functional | Automated | new |

## Execution (real Playwright run)
14 executed · 13 passed · 1 failed · 1 not run · pass rate 92.9%

| Key | Test | Result | ms |
|---|---|---|---|
| TC-F-001 | The reservation model has 1000 attributes and a full reservation is accepted | passed | 36 |
| TC-F-002 | Advisor views the commission breakdown on the commission statement page | passed | 244 |
| TC-N-001 | Commission quote p95 response time is within 300 ms | passed | 60 |
| TC-F-003 | Base commission is 10% of commissionable room revenue | passed | 12 |
| TC-F-004 | Taxes, resort fees and ancillaries are excluded from commissionable revenue | passed | 9 |
| TC-F-005 | GDS reservations earn an additional 1.5% channel uplift | passed | 8 |
| TC-F-006 | A stay of exactly 7 nights earns the 1.5% long-stay bonus | failed | 9 |
| TC-F-007 | A stay of 6 nights earns no long-stay bonus | passed | 28 |
| TC-F-008 | Commission is capped at USD 500 per reservation | passed | 10 |
| TC-F-009 | Commission is rounded half-up to 2 decimal places | passed | 11 |
| TC-F-010 | A stay paid with loyalty points earns no commission | passed | 14 |
| TC-F-011 | Cancelled and no-show reservations earn no commission | passed | 11 |
| TC-F-012 | Verify: Every commission calculation is written to the commission audit ledger | not-run | 0 |
| TC-F-013 | A reservation without an advisor IATA number returns HTTP 422 | passed | 13 |
| TC-F-014 | Commission for an unknown reservation ID returns HTTP 404 | passed | 4 |

## Defects (1)
| ID | Title | Severity | Expected | Actual | Test case |
|---|---|---|---|---|---|
| DEF-001 | A stay of exactly 7 nights earns the 1.5% long-stay bonus: returns 80 instead of 92 | Critical | 92 | 80 | TC-F-006 |

## Approvals
| Gate | Decision | By | When |
|---|---|---|---|
| Requirement set review | approved | Priya Shah | 2026-09-28T21:39:40.127Z |
