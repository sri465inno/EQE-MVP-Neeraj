# QE lead report - Hotel booking release 2.0 (AQPI-32 + AQPI-23)

CYC-4 · incremental cycle

> **Recommendation: No-go.** 1 release-blocking defect open (DEF-001).

| Type of testing | Requirements | Test cases | Automated | Pass rate | Defects | Requirements verified |
|---|---|---|---|---|---|---|
| Regression testing | 138 | 144 | 83 | 95.2% | 4 | 44.2% |

## 1. Summary
- Incremental cycle for Guest hotel booking from search to confirmation (AQPI-1) on build demo/hotel-booking-platform-v2, 2026-10-05 16:57 UTC.
- Type of testing: Regression testing. The full pack: every functional case plus the privacy, security, observability and resilience cases, so nothing that worked before has broken.
- We took 2 inputs (Jira epic AQPI-32, AQPI-23, Codebase sri465inno/EQE-MVP-Neeraj@demo/hotel-booking-platform-v2 (fe1ce44)) and produced 138 requirements, 144 test cases and 65 automated scripts.
- We ran 83 automated tests for real: 79 passed, 4 failed (pass rate 95.2%). 61 manual tests still to be run by hand.
- 4 defects open from real failures (2 still open, 2 new), 1 release-blocking: DEF-001 A price change within 1% does not need acknowledgement: returns true instead of false (Jira: not raised in Jira; linked to AQPI-17 in the platform); DEF-002 A key shorter than 8 characters is refused: returns 201 instead of 400 (Jira: not raised in Jira; linked to AQPI-21 in the platform); DEF-007 A 15-night stay in Paris is rejected: returns 200 instead of 400 (Jira: not raised in Jira; linked to AQPI-34 in the platform); DEF-008 Operations can retry a failed confirmation e-mail 3 times; retry 4 is refused: returns 200 instead of 409 (Jira: not raised in Jira; linked to AQPI-25 in the platform).
- 1 defect fixed, retested and certified closed: DEF-003 9 rooms in one search are rejected: returns 200 instead of 400 (story AQPI-4, first seen in CYC-1; TC-F-126 passed on build demo/hotel-booking-platform-v2).
- Against the baseline: 20 unchanged · 3 enhanced · 10 new. 126 of 144 test cases were reused unchanged; only new and changed items were redesigned.

## 2. Inputs taken
| Input | Reference | What we took from it | Source |
|---|---|---|---|
| Jira epic | AQPI-32, AQPI-23 | 2 epics: [Epic 8] Release 2.0 – Booking Rule Changes and Free Cancellation; [Epic 6] Confirmation and Notifications; stories AQPI-33, AQPI-34, AQPI-35, AQPI-36, AQPI-24, AQPI-25, AQPI-26, AQPI-37; 33 statements | Jira export on GitHub |
| Codebase | sri465inno/EQE-MVP-Neeraj@demo/hotel-booking-platform-v2 (fe1ce44) | AQPI-1 Intelligent Hotel Shopping and Reservation Experience: reactive Spring Boot microservices; 13 statements | pulled from GitHub |

## 3. How we ran the cycle
1. Read 46 statements from the inputs and lined them up into 33 requirement groups: 9 agreed by every source, 20 only in Jira, 4 only in the code, 0 in conflict.
2. The review agent read the inputs first and suggested 17 addition(s), 33 missing piece(s) and 0 conflict(s) for the reviewer (2 high severity). It approved nothing.
3. Priya Shah reviewed and approved the requirement set on 2026-10-05 16:57 UTC.
4. Compared every statement with baseline BL-1 v1: 20 unchanged · 3 enhanced · 10 new. Changed: REQ-122 "A cart expires 30 minutes after it is created and never creates a reservation itself." → "A cart expires 20 minutes after it is created and never creates a reservation itself."; REQ-124 "A confirmation can be resent at most 3 times per booking in 24 hours." → "A confirmation can be resent at most 5 times per booking in 24 hours."; REQ-126 "A stay can be at most 30 nights; Paris (PAR) allows at most 21 nights." → "A stay can be at most 30 nights; Paris (PAR) allows at most 14 nights.".
5. Regression testing steered the design: Re-runs every case carried over from the baseline alongside the new and re-designed ones. Result: 144 case(s) in this run (126 reused, 6 re-designed, 12 new).
6. The requirements agent wrote 138 requirements, each with its business rule, exact values and source quotes (72 automatable, 66 manual); the agents then designed 144 test cases (140 functional, 4 non-functional) and generated 65 Playwright scripts.
7. Sam Lee approved the merge into the baseline on 2026-10-05 16:57 UTC.
8. Executed the automated suite with Playwright 1.63.0 (headless Chromium, JSON reporter) against Hotel booking platform release 2.0, six Spring Boot services built from branch demo/hotel-booking-platform-v2; defects were raised only for tests that actually failed.

## 4. Artifacts produced
| Artifact | Count | Notes | Folder |
|---|---|---|---|
| Inputs and provenance | 2 | what was taken from each source, and where from | [01-inputs/](01-inputs/) |
| Review agent suggestions | 50 | 17 added · 33 missing · 0 conflicts (advisory) | [01-inputs/review-agent.json](01-inputs/review-agent.json) |
| Normalised requirement set | 33 | 9 agreed · 20 Jira-only · 4 code-only · 0 conflicts | [01-inputs/normalisation.json](01-inputs/normalisation.json) |
| Delta against baseline | 33 | 20 unchanged · 3 enhanced · 10 new | [01-inputs/delta-classification.json](01-inputs/delta-classification.json) |
| Requirement set (with business rules) | 138 | 105 carried over · 20 unchanged · 3 enhanced · 10 new · 138 business rules with exact values and source quotes (72 automatable · 66 manual) | [02-requirements/](02-requirements/) |
| Test cases (Excel, Zephyr Scale format) | 144 | 83 automated · 61 not automated | [03-test-cases/](03-test-cases/) |
| Test data (one data set per test case) | 144 | 136 conform to Hotel booking attributes v1.0 (21 attributes) · 8 negative tests | [04-test-data/](04-test-data/) |
| Automation scripts (Playwright) | 65 | 55 carried over · 3 re-designed · 7 new | [05-automation-scripts/](05-automation-scripts/) |
| Merge approval | 1 | approved by Sam Lee | [09-merge-approval/](09-merge-approval/) |
| Execution results and evidence | 83 | 79 passed · 4 failed · 61 manual | [06-execution/](06-execution/) |
| Traceability matrix | 144 | 37 of 37 Jira items covered · 24 verified · 4 failing | [08-report/traceability.json](08-report/traceability.json) |
| Defects | 4 | DEF-001 Critical still open · DEF-002 Medium still open · DEF-007 Medium new · DEF-008 Medium new · fixed and certified: DEF-003 | [07-defects/](07-defects/) |
| Cycle report (HTML, Excel) | 1 | full detail behind this summary | [08-report/](08-report/) |

## 5. Risks and open items
- 12 requirements had no case in this regression testing run (REQ-001, REQ-002, REQ-004, REQ-005, REQ-006, REQ-007, REQ-023, REQ-051, REQ-092, REQ-110, REQ-114, REQ-118); a wider run is needed before release.
- Review agent (RA-09): Asked for in Jira but not mentioned in the code. Tests are designed from the Jira wording; expect them to fail until it is built, or confirm with the developers where it lives.
- DEF-001 (Critical): a guest is charged or booked wrongly. Expected false, got true. Blocks the release: a guest is charged or booked wrongly (BR-123). Story AQPI-17; Jira: not raised in Jira; linked to AQPI-17 in the platform.
- DEF-002 (Medium): wrong value or status with a workaround. Expected 400, got 201. Does not block the release: wrong value or status with a workaround. Story AQPI-21; Jira: not raised in Jira; linked to AQPI-21 in the platform.
- DEF-007 (Medium): wrong value or status with a workaround. Expected 400, got 200. Does not block the release: wrong value or status with a workaround. Story AQPI-34; Jira: not raised in Jira; linked to AQPI-34 in the platform.
- DEF-008 (Medium): wrong value or status with a workaround. Expected 409, got 200. Does not block the release: wrong value or status with a workaround. Story AQPI-25; Jira: not raised in Jira; linked to AQPI-25 in the platform.
- 61 test cases cannot be automated and were not executed: TC-F-002 Verify: Required business and technical events are logged using approved identifiers and masking rules; TC-F-003 Verify: All child user stories meet their acceptance criteria and the Definition of Done; TC-F-004 Verify: Negative and error paths for each story are tested and evidenced; TC-F-005 Verify: Required logging is in place and verified free of sensitive data; TC-F-006 Verify: The Product Owner has accepted the capability end to end; TC-F-012 Verify: Check-in must precede check-out; TC-F-013 Verify: Occupancy must comply with configured room limits; TC-F-014 Verify: Maximum stay length must be configurable; TC-F-017 Verify: Server validation is authoritative when client and server results differ; TC-F-018 Verify: Validation rules must be configurable where market or property rules vary; TC-F-020 Verify: Technical failures display a non-technical message and retry option; TC-F-029 Verify: Selected criteria are visible and removable; TC-F-032 Verify: The guest can select a valid room and rate plan; TC-F-033 Verify: If inventory changes, the guest is informed before continuing; TC-F-035 Verify: The service considers available context such as stay dates, season, destination, hotel, room, party composition, declared interests, and consented profile attributes; TC-F-038 Verify: When personalization data is unavailable, safe contextual defaults may be returned; TC-F-039 Verify: Sensitive traits must not be inferred or used; TC-F-040 Verify: Personalization must honor consent and data-retention rules; TC-F-041 Verify: Business rules and model versions must be auditable; TC-F-045 Verify: The interface identifies when offers are personalized where required; TC-F-049 Verify: Inventory and price are revalidated when required; TC-F-050 Verify: The cart has a defined expiration and displays relevant timeout behavior; TC-F-051 Verify: A cart must not itself create a reservation; TC-F-052 Verify: Price-change handling must require guest acknowledgement when material; TC-F-053 Verify: The guest can add an available ancillary; TC-F-056 Verify: Ineligible or sold-out products cannot be retained silently; TC-F-058 Verify: Currency is consistently displayed; TC-F-059 Verify: Material changes are highlighted and require acknowledgement; TC-F-060 Verify: The guest can return to edit supported selections; TC-F-061 Verify: The final payable total must be revalidated before reservation submission; TC-F-064 Verify: Data is transmitted securely and is not exposed in client logs; TC-F-065 Verify: Data minimization applies; TC-F-069 Verify: Payment data is handled through approved secure components; TC-F-074 Verify: Payment requirements depend on rate conditions; TC-F-075 Verify: Retry behavior must avoid duplicate authorization; TC-F-079 Verify: Partial failures trigger defined recovery or manual-review handling; TC-F-080 Verify: Reservation submission must use an idempotency mechanism; TC-F-081 Verify: The source of truth for confirmation status must be defined; TC-F-087 Verify: Only necessary personal data may be included; TC-F-089 Verify: A successful reservation creates one confirmation-email request; TC-F-091 Verify: Permitted retries avoid duplicate or excessive messages; TC-F-092 Verify: Operational users can distinguish queued, sent, delivered, bounced, and failed states when supported by the provider; TC-F-093 Verify: Email addresses must be masked outside authorized operational views; TC-F-095 Verify: Rate limits and abuse controls apply; TC-F-096 Verify: The resend creates a new message event without creating a new reservation; TC-F-097 Verify: Sensitive data is classified and mapped to approved storage and processing locations; TC-F-098 Verify: Data is encrypted in transit and at rest where required; TC-F-099 Verify: Logs and analytics exclude or mask prohibited fields; TC-F-101 Verify: Retention and deletion follow approved policy; TC-F-103 Verify: Business events and technical logs are distinguishable; TC-F-104 Verify: Logging degradation does not expose sensitive payloads or silently block booking unless explicitly required; TC-F-105 Verify: Event schemas must be versioned; TC-F-106 Verify: Production log access must be controlled and retained according to policy; TC-F-107 Verify: Visual information is not conveyed by color alone; TC-F-108 Verify: Dynamic updates are announced appropriately; TC-F-109 Verify: Timeout, retry, circuit-breaker, and fallback behavior are documented; TC-F-110 Verify: Load, resilience, and recovery tests cover critical journeys; TC-F-111 Verify: Reservation integrity is prioritized over non-critical personalization and analytics; TC-F-129 Verify: Release 1.0 behaviour not named in this epic is unchanged and passes regression; TC-F-130 Verify: The Product Owner has accepted the release 2.0 changes end to end; TC-F-140 Verify: Operational users see the cancellation e-mail with its own delivery state, separate from the confirmation. Needs a manual run before sign-off.
- 77 requirements not yet verified by a passing test: REQ-001 (not covered); REQ-002 (not covered); REQ-004 (not covered); REQ-005 (not covered); REQ-006 (not covered); REQ-007 (not covered); REQ-008 (designed only (manual)); REQ-009 (designed only (manual)); REQ-010 (designed only (manual)); REQ-011 (designed only (manual)); REQ-012 (designed only (manual)); REQ-017 (designed only (manual)); REQ-018 (designed only (manual)); REQ-019 (designed only (manual)); REQ-022 (designed only (manual)); REQ-023 (not covered); REQ-024 (designed only (manual)); REQ-026 (designed only (manual)); REQ-035 (designed only (manual)); REQ-038 (designed only (manual)); REQ-039 (designed only (manual)); REQ-041 (designed only (manual)); REQ-044 (designed only (manual)); REQ-045 (designed only (manual)); REQ-046 (designed only (manual)); REQ-047 (designed only (manual)); REQ-051 (not covered); REQ-052 (designed only (manual)); REQ-056 (designed only (manual)); REQ-057 (designed only (manual)); REQ-058 (designed only (manual)); REQ-059 (designed only (manual)); REQ-060 (designed only (manual)); REQ-063 (designed only (manual)); REQ-065 (designed only (manual)); REQ-066 (designed only (manual)); REQ-067 (designed only (manual)); REQ-068 (designed only (manual)); REQ-072 (designed only (manual)); REQ-073 (designed only (manual)); REQ-076 (designed only (manual)); REQ-079 (designed only (manual)); REQ-080 (designed only (manual)); REQ-084 (designed only (manual)); REQ-085 (designed only (manual)); REQ-086 (designed only (manual)); REQ-092 (not covered); REQ-093 (designed only (manual)); REQ-095 (designed only (manual)); REQ-097 (designed only (manual)); REQ-098 (designed only (manual)); REQ-099 (designed only (manual)); REQ-101 (designed only (manual)); REQ-102 (designed only (manual)); REQ-103 (designed only (manual)); REQ-104 (designed only (manual)); REQ-105 (designed only (manual)); REQ-107 (designed only (manual)); REQ-109 (designed only (manual)); REQ-110 (not covered); REQ-111 (designed only (manual)); REQ-112 (designed only (manual)); REQ-113 (designed only (manual)); REQ-114 (not covered); REQ-115 (designed only (manual)); REQ-116 (designed only (manual)); REQ-118 (not covered); REQ-119 (designed only (manual)); REQ-120 (designed only (manual)); REQ-121 (designed only (manual)); REQ-123 (executed - failing); REQ-125 (executed - failing); REQ-126 (executed - failing); REQ-129 (designed only (manual)); REQ-130 (designed only (manual)); REQ-135 (executed - failing); REQ-138 (designed only (manual)).
- 24 requirement groups come from a single source only; the product owner should confirm them.

_13 of 15 booking-driving attributes (out of 21 booking attributes) are varied by at least one test._

## 6. Recommendation and next steps
**No-go.** 1 release-blocking defect open (DEF-001).

- Fix DEF-001 and re-run TC-F-114; it must pass before release.
- Run TC-F-002, TC-F-003, TC-F-004, TC-F-005, TC-F-006, TC-F-012, TC-F-013, TC-F-014, TC-F-017, TC-F-018, TC-F-020, TC-F-029, TC-F-032, TC-F-033, TC-F-035, TC-F-038, TC-F-039, TC-F-040, TC-F-041, TC-F-045, TC-F-049, TC-F-050, TC-F-051, TC-F-052, TC-F-053, TC-F-056, TC-F-058, TC-F-059, TC-F-060, TC-F-061, TC-F-064, TC-F-065, TC-F-069, TC-F-074, TC-F-075, TC-F-079, TC-F-080, TC-F-081, TC-F-087, TC-F-089, TC-F-091, TC-F-092, TC-F-093, TC-F-095, TC-F-096, TC-F-097, TC-F-098, TC-F-099, TC-F-101, TC-F-103, TC-F-104, TC-F-105, TC-F-106, TC-F-107, TC-F-108, TC-F-109, TC-F-110, TC-F-111, TC-F-129, TC-F-130, TC-F-140 manually and record the result.
- Keep the updated baseline as the reference for the next release.

## Traceability by story
| Jira item | Level | Summary | Requirements | Test cases | Passed | Failed | Defects | Status |
|---|---|---|---|---|---|---|---|---|
| AQPI-32 | epic | [Epic 8] Release 2.0 – Booking Rule Changes and Free Cancellation | 2 | 2 | 0 | 0 | - | designed, not executed |
| AQPI-33 | story | 10.1 Shorten the cart hold to 20 minutes | 1 | 1 | 1 | 0 | - | verified |
| AQPI-34 | story | 10.2 Limit Paris stays to 14 nights | 1 | 4 | 3 | 1 | DEF-007 | failing |
| AQPI-35 | story | 10.3 Allow up to 5 confirmation resends | 1 | 1 | 1 | 0 | - | verified |
| AQPI-36 | story | 10.4 Cancel a reservation free of charge | 3 | 4 | 4 | 0 | - | verified |
| AQPI-23 | epic | [Epic 6] Confirmation and Notifications | 4 | 4 | 0 | 0 | - | designed, not executed |
| AQPI-24 | story | 8.1 Generate confirmation message | 5 | 6 | 5 | 0 | - | verified |
| AQPI-25 | story | 8.2 Send and track confirmation email | 6 | 6 | 1 | 1 | DEF-008 | failing |
| AQPI-26 | story | 8.3 Resend confirmation safely | 3 | 3 | 1 | 0 | - | verified |
| AQPI-37 | story | 8.4 Send a cancellation e-mail | 3 | 3 | 2 | 0 | - | verified |
| AQPI-2 | epic | [Epic 1] Search and Availability | 4 | 4 | 0 | 0 | - | designed, not executed |
| AQPI-3 | story | 3.1 Search hotels by destination and date range | 7 | 9 | 6 | 0 | - | verified |
| AQPI-4 | story | 3.2 Validate occupancy and stay criteria | 6 | 10 | 8 | 0 | - | verified |
| AQPI-5 | story | 3.3 Handle unavailable or failed searches | 3 | 3 | 2 | 0 | - | verified |
| AQPI-6 | epic | [Epic 2] Hotel Results and Selection | 4 | 4 | 0 | 0 | - | designed, not executed |
| AQPI-7 | story | 4.1 Display available hotels | 5 | 5 | 5 | 0 | - | verified |
| AQPI-8 | story | 4.2 Sort and filter hotel results | 4 | 5 | 4 | 0 | - | verified |
| AQPI-9 | story | 4.3 View hotel and room details | 4 | 4 | 2 | 0 | - | verified |
| AQPI-10 | epic | [Epic 3] Personalized Ancillary Offers | 4 | 4 | 0 | 0 | - | designed, not executed |
| AQPI-11 | story | 5.1 Determine eligible ancillary offers | 7 | 7 | 2 | 0 | - | verified |
| AQPI-12 | story | 5.2 Display ancillary offers | 3 | 3 | 3 | 0 | - | verified |
| AQPI-13 | story | 5.3 Explain and control personalization | 3 | 3 | 2 | 0 | - | verified |
| AQPI-14 | epic | [Epic 4] Cart Management | 4 | 4 | 0 | 0 | - | designed, not executed |
| AQPI-15 | story | 6.1 Add room selection to cart | 5 | 5 | 1 | 0 | - | verified |
| AQPI-16 | story | 6.2 Add, update, and remove ancillaries | 4 | 4 | 2 | 0 | - | verified |
| AQPI-17 | story | 6.3 Review cart and total price | 6 | 7 | 2 | 1 | DEF-001 | failing |
| AQPI-18 | epic | [Epic 5] Checkout and Reservation | 4 | 4 | 0 | 0 | - | designed, not executed |
| AQPI-19 | story | 7.1 Capture guest and contact information | 6 | 6 | 4 | 0 | - | verified |
| AQPI-20 | story | 7.2 Capture and authorize payment | 6 | 9 | 6 | 0 | - | verified |
| AQPI-21 | story | 7.3 Create reservation idempotently | 7 | 9 | 5 | 1 | DEF-002 | failing |
| AQPI-22 | story | 7.4 Show booking outcome | 3 | 3 | 3 | 0 | - | verified |
| AQPI-27 | epic | [Epic 7] Cross-Cutting Quality, Privacy and Observability | 4 | 4 | 0 | 0 | - | designed, not executed |
| AQPI-28 | story | 9.1 Protect sensitive data | 5 | 5 | 1 | 0 | - | verified |
| AQPI-29 | story | 9.2 Provide end-to-end observability | 5 | 5 | 1 | 0 | - | verified |
| AQPI-30 | story | 9.3 Meet accessibility requirements | 3 | 3 | 1 | 0 | - | verified |
| AQPI-31 | story | 9.4 Meet performance and reliability objectives | 3 | 3 | 0 | 0 | - | designed, not executed |

## 7. Sign-off
| Gate | Decision | By | When | Detail |
|---|---|---|---|---|
| Requirement set review | approved | Priya Shah | 2026-10-05 16:57 UTC | 33 requirements approved; 0 excluded; 0 conflict(s) resolved |
| Merge into baseline | approved | Sam Lee | 2026-10-05 16:57 UTC | 13 requirements, 18 test cases, 10 scripts merged: BL-1 v1 -> v2 |

_Agentic QE Platform (QE lead report, computed from the cycle) · generated 2026-10-05 16:58 UTC. Every figure comes from the persisted cycle; nothing is estimated._
