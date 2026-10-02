# QE lead report - Hotel booking baseline · End-to-end

CYC-3 · baseline cycle

> **Recommendation: Conditional go.** No release-blocking defects, but there are open items to accept or close.

| Type of testing | Requirements | Test cases | Automated | Pass rate | Defects | Requirements verified |
|---|---|---|---|---|---|---|
| End-to-end testing | 128 | 8 | 8 | 100% | 0 | 5.5% |

## 1. Summary
- Baseline cycle for Guest hotel booking from search to confirmation (AQPI-1) on build demo/hotel-booking-platform, 2026-10-02 19:44 UTC.
- Type of testing: End-to-end testing. The guest's booking journey through the six services: search, hotel details, offers, cart, payment, reservation and the confirmation e-mail.
- We took 3 inputs (Jira initiative AQPI-1, Jira epic AQPI-2, AQPI-6, AQPI-10, AQPI-14, AQPI-18, AQPI-23, AQPI-27, Codebase sri465inno/uc-agentic-quality-engineering@demo/hotel-booking-platform (35af1ef)) and produced 128 requirements, 8 test cases and 7 automated scripts.
- We ran 8 automated tests for real: 8 passed, 0 failed (pass rate 100%). 
- No defects: nothing failed.

## 2. Inputs taken
| Input | Reference | What we took from it | Source |
|---|---|---|---|
| Jira initiative | AQPI-1 | [Initiative] Intelligent Hotel Shopping and Reservation Experience; 8 statements | Jira export on GitHub |
| Jira epic | AQPI-2, AQPI-6, AQPI-10, AQPI-14, AQPI-18, AQPI-23, AQPI-27 | 7 epics: [Epic 1] Search and Availability; [Epic 2] Hotel Results and Selection; [Epic 3] Personalized Ancillary Offers; [Epic 4] Cart Management; [Epic 5] Checkout and Reservation; [Epic 6] Confirmation and Notifications; [Epic 7] Cross-Cutting Quality, Privacy and Observability; stories AQPI-3, AQPI-4, AQPI-5, AQPI-7, AQPI-8, AQPI-9, AQPI-11, AQPI-12, AQPI-13, AQPI-15, AQPI-16, AQPI-17, AQPI-19, AQPI-20, AQPI-21, AQPI-22, AQPI-24, AQPI-25, AQPI-26, AQPI-28, AQPI-29, AQPI-30, AQPI-31; 137 statements | Jira export on GitHub |
| Codebase | sri465inno/uc-agentic-quality-engineering@demo/hotel-booking-platform (35af1ef) | AQPI-1 Intelligent Hotel Shopping and Reservation Experience: reactive Spring Boot microservices; 7 statements | pulled from GitHub |

## 3. How we ran the cycle
1. Read 152 statements from the inputs and lined them up into 128 requirement groups: 0 agreed by every source, 121 only in Jira, 7 only in the code, 0 in conflict.
2. The review agent read the inputs first and suggested 7 addition(s), 184 missing piece(s) and 0 conflict(s) for the reviewer (8 high severity). It approved nothing.
3. Priya Shah reviewed and approved the requirement set on 2026-10-02 19:44 UTC.
4. End-to-end testing steered the design: Designs one API journey per guest flow in the inputs and runs it against the six hotel services, keeping every request and response as evidence. The services have no browser screen, so no screenshots are taken. Result: 8 case(s) in this run (0 reused, 0 re-designed, 8 new).
5. Derived 128 business rules (each quoting its source), designed 8 test cases (8 functional) and generated 7 Playwright scripts.
6. Executed the automated suite with Playwright 1.63.0 (headless Chromium, JSON reporter) against Hotel booking platform release 1.0, six Spring Boot services built from branch demo/hotel-booking-platform; defects were raised only for tests that actually failed.

## 4. Artifacts produced
| Artifact | Count | Notes | Folder |
|---|---|---|---|
| Inputs and provenance | 3 | what was taken from each source, and where from | [01-inputs/](01-inputs/) |
| Review agent suggestions | 191 | 7 added · 184 missing · 0 conflicts (advisory) | [01-inputs/review-agent.json](01-inputs/review-agent.json) |
| Normalised requirement set | 128 | 0 agreed · 121 Jira-only · 7 code-only · 0 conflicts | [01-inputs/normalisation.json](01-inputs/normalisation.json) |
| Requirements repository | 128 | 128 new | [02-requirements/](02-requirements/) |
| Business rules | 128 | 65 executable, each with a source quote | [03-business-rules/](03-business-rules/) |
| Test cases (Excel, Zephyr Scale format) | 8 | 8 automated | [04-test-cases/](04-test-cases/) |
| Test data (one data set per test case) | 8 | 8 conform to Hotel booking attributes v1.0 (21 attributes) · 0 negative tests | [05-test-data/](05-test-data/) |
| Automation scripts (Playwright) | 7 | 7 new | [06-automation-scripts/](06-automation-scripts/) |
| Execution results and evidence | 8 | 8 passed · 0 failed · 0 manual | [07-execution/](07-execution/) |
| Traceability matrix | 8 | 2 of 31 Jira items covered · 2 verified · 0 failing | [09-report/traceability.json](09-report/traceability.json) |
| Defects | 0 | none | [08-defects/](08-defects/) |
| Cycle report (HTML, Excel) | 1 | full detail behind this summary | [09-report/](09-report/) |

## 5. Risks and open items
- End-to-end testing: The hotel services have no browser screen, so the journeys run through the service APIs; screen checks such as keyboard and focus order stay manual.
- 121 requirements had no case in this end-to-end testing run (REQ-003, REQ-008, REQ-009, REQ-010, REQ-011, REQ-012, REQ-013, REQ-014, REQ-015, REQ-016, REQ-017, REQ-018, REQ-019, REQ-020, REQ-021, REQ-022, REQ-023, REQ-024, REQ-025, REQ-026, REQ-027, REQ-028, REQ-029, REQ-030, REQ-031, REQ-032, REQ-033, REQ-034, REQ-035, REQ-036, REQ-037, REQ-038, REQ-039, REQ-040, REQ-041, REQ-042, REQ-043, REQ-044, REQ-045, REQ-046, REQ-047, REQ-048, REQ-049, REQ-050, REQ-052, REQ-053, REQ-054, REQ-055, REQ-056, REQ-057, REQ-058, REQ-059, REQ-060, REQ-061, REQ-062, REQ-063, REQ-064, REQ-065, REQ-066, REQ-067, REQ-068, REQ-069, REQ-070, REQ-071, REQ-072, REQ-073, REQ-074, REQ-075, REQ-076, REQ-077, REQ-078, REQ-079, REQ-080, REQ-081, REQ-082, REQ-083, REQ-084, REQ-085, REQ-086, REQ-087, REQ-088, REQ-089, REQ-090, REQ-091, REQ-092, REQ-093, REQ-094, REQ-095, REQ-096, REQ-097, REQ-098, REQ-099, REQ-100, REQ-101, REQ-102, REQ-103, REQ-104, REQ-105, REQ-106, REQ-107, REQ-108, REQ-109, REQ-110, REQ-111, REQ-112, REQ-113, REQ-114, REQ-115, REQ-116, REQ-117, REQ-118, REQ-119, REQ-120, REQ-121, REQ-122, REQ-123, REQ-124, REQ-125, REQ-126, REQ-127, REQ-128); a wider run is needed before release.
- Review agent (RA-10): Asked for in Jira but not mentioned in the code. Tests are designed from the Jira wording; expect them to fail until it is built, or confirm with the developers where it lives.
- Review agent (RA-12): Asked for in Jira but not mentioned in the code. Tests are designed from the Jira wording; expect them to fail until it is built, or confirm with the developers where it lives.
- Review agent (RA-71): Asked for in Jira but not mentioned in the code. Tests are designed from the Jira wording; expect them to fail until it is built, or confirm with the developers where it lives.
- Review agent (RA-82): Asked for in Jira but not mentioned in the code. Tests are designed from the Jira wording; expect them to fail until it is built, or confirm with the developers where it lives.
- Review agent (RA-84): Asked for in Jira but not mentioned in the code. Tests are designed from the Jira wording; expect them to fail until it is built, or confirm with the developers where it lives.
- Review agent (RA-88): Asked for in Jira but not mentioned in the code. Tests are designed from the Jira wording; expect them to fail until it is built, or confirm with the developers where it lives.
- Review agent (RA-89): Asked for in Jira but not mentioned in the code. Tests are designed from the Jira wording; expect them to fail until it is built, or confirm with the developers where it lives.
- 121 requirements not yet verified by a passing test: REQ-003 (not covered); REQ-008 (not covered); REQ-009 (not covered); REQ-010 (not covered); REQ-011 (not covered); REQ-012 (not covered); REQ-013 (not covered); REQ-014 (not covered); REQ-015 (not covered); REQ-016 (not covered); REQ-017 (not covered); REQ-018 (not covered); REQ-019 (not covered); REQ-020 (not covered); REQ-021 (not covered); REQ-022 (not covered); REQ-023 (not covered); REQ-024 (not covered); REQ-025 (not covered); REQ-026 (not covered); REQ-027 (not covered); REQ-028 (not covered); REQ-029 (not covered); REQ-030 (not covered); REQ-031 (not covered); REQ-032 (not covered); REQ-033 (not covered); REQ-034 (not covered); REQ-035 (not covered); REQ-036 (not covered); REQ-037 (not covered); REQ-038 (not covered); REQ-039 (not covered); REQ-040 (not covered); REQ-041 (not covered); REQ-042 (not covered); REQ-043 (not covered); REQ-044 (not covered); REQ-045 (not covered); REQ-046 (not covered); REQ-047 (not covered); REQ-048 (not covered); REQ-049 (not covered); REQ-050 (not covered); REQ-052 (not covered); REQ-053 (not covered); REQ-054 (not covered); REQ-055 (not covered); REQ-056 (not covered); REQ-057 (not covered); REQ-058 (not covered); REQ-059 (not covered); REQ-060 (not covered); REQ-061 (not covered); REQ-062 (not covered); REQ-063 (not covered); REQ-064 (not covered); REQ-065 (not covered); REQ-066 (not covered); REQ-067 (not covered); REQ-068 (not covered); REQ-069 (not covered); REQ-070 (not covered); REQ-071 (not covered); REQ-072 (not covered); REQ-073 (not covered); REQ-074 (not covered); REQ-075 (not covered); REQ-076 (not covered); REQ-077 (not covered); REQ-078 (not covered); REQ-079 (not covered); REQ-080 (not covered); REQ-081 (not covered); REQ-082 (not covered); REQ-083 (not covered); REQ-084 (not covered); REQ-085 (not covered); REQ-086 (not covered); REQ-087 (not covered); REQ-088 (not covered); REQ-089 (not covered); REQ-090 (not covered); REQ-091 (not covered); REQ-092 (not covered); REQ-093 (not covered); REQ-094 (not covered); REQ-095 (not covered); REQ-096 (not covered); REQ-097 (not covered); REQ-098 (not covered); REQ-099 (not covered); REQ-100 (not covered); REQ-101 (not covered); REQ-102 (not covered); REQ-103 (not covered); REQ-104 (not covered); REQ-105 (not covered); REQ-106 (not covered); REQ-107 (not covered); REQ-108 (not covered); REQ-109 (not covered); REQ-110 (not covered); REQ-111 (not covered); REQ-112 (not covered); REQ-113 (not covered); REQ-114 (not covered); REQ-115 (not covered); REQ-116 (not covered); REQ-117 (not covered); REQ-118 (not covered); REQ-119 (not covered); REQ-120 (not covered); REQ-121 (not covered); REQ-122 (not covered); REQ-123 (not covered); REQ-124 (not covered); REQ-125 (not covered); REQ-126 (not covered); REQ-127 (not covered); REQ-128 (not covered).
- 128 requirement groups come from a single source only; the product owner should confirm them.
- At least one agent did not hand over every artifact its skills require; see Skills and hand-overs.

_6 of 15 booking-driving attributes (out of 21 booking attributes) are varied by at least one test._

## 6. Recommendation and next steps
**Conditional go.** No release-blocking defects, but there are open items to accept or close.

- Cover or accept 121 requirements not yet verified by a passing test.
- Use this approved baseline as the reference for the next incremental cycle.

## Traceability by story
| Jira item | Level | Summary | Requirements | Test cases | Passed | Failed | Defects | Status |
|---|---|---|---|---|---|---|---|---|
| AQPI-2 | epic | [Epic 1] Search and Availability | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-3 | story | 3.1 Search hotels by destination and date range | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-4 | story | 3.2 Validate occupancy and stay criteria | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-5 | story | 3.3 Handle unavailable or failed searches | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-6 | epic | [Epic 2] Hotel Results and Selection | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-7 | story | 4.1 Display available hotels | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-8 | story | 4.2 Sort and filter hotel results | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-9 | story | 4.3 View hotel and room details | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-10 | epic | [Epic 3] Personalized Ancillary Offers | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-11 | story | 5.1 Determine eligible ancillary offers | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-12 | story | 5.2 Display ancillary offers | 1 | 1 | 1 | 0 | - | verified |
| AQPI-13 | story | 5.3 Explain and control personalization | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-14 | epic | [Epic 4] Cart Management | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-15 | story | 6.1 Add room selection to cart | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-16 | story | 6.2 Add, update, and remove ancillaries | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-17 | story | 6.3 Review cart and total price | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-18 | epic | [Epic 5] Checkout and Reservation | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-19 | story | 7.1 Capture guest and contact information | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-20 | story | 7.2 Capture and authorize payment | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-21 | story | 7.3 Create reservation idempotently | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-22 | story | 7.4 Show booking outcome | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-23 | epic | [Epic 6] Confirmation and Notifications | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-24 | story | 8.1 Generate confirmation message | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-25 | story | 8.2 Send and track confirmation email | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-26 | story | 8.3 Resend confirmation safely | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-27 | epic | [Epic 7] Cross-Cutting Quality, Privacy and Observability | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-28 | story | 9.1 Protect sensitive data | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-29 | story | 9.2 Provide end-to-end observability | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-30 | story | 9.3 Meet accessibility requirements | 0 | 0 | 0 | 0 | - | not covered |
| AQPI-31 | story | 9.4 Meet performance and reliability objectives | 0 | 0 | 0 | 0 | - | not covered |

## 7. Sign-off
| Gate | Decision | By | When | Detail |
|---|---|---|---|---|
| Requirement set review | approved | Priya Shah | 2026-10-02 19:44 UTC | 128 requirements approved; 0 excluded; 0 conflict(s) resolved |

_Agentic QE Platform (QE lead report, computed from the cycle) · generated 2026-10-02 19:44 UTC. Every figure comes from the persisted cycle; nothing is estimated._
