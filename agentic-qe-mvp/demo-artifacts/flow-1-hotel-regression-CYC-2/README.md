# QE lead report - Hotel booking baseline · Regression

CYC-2 · baseline cycle

> **Recommendation: Conditional go.** No release-blocking defects, but there are open items to accept or close.

| Type of testing | Requirements | Test cases | Automated | Pass rate | Defects | Requirements verified |
|---|---|---|---|---|---|---|
| Regression testing | 128 | 137 | 74 | 100% | 0 | 45.3% |

## 1. Summary
- Baseline cycle for Guest hotel booking from search to confirmation (AQPI-1) on build demo/hotel-booking-platform, 2026-10-02 15:08 UTC.
- Type of testing: Regression testing. The full pack: every functional case plus the privacy, security, observability and resilience cases, so nothing that worked before has broken.
- We took 3 inputs (Jira initiative AQPI-1, Jira epic AQPI-2, AQPI-6, AQPI-10, AQPI-14, AQPI-18, AQPI-23, AQPI-27, Codebase sri465inno/uc-agentic-quality-engineering@demo/hotel-booking-platform (35af1ef)) and produced 128 requirements, 137 test cases and 58 automated scripts.
- We ran 74 automated tests for real: 74 passed, 0 failed (pass rate 100%). 63 manual tests still to be run by hand.
- No defects: nothing failed.

## 2. Inputs taken
| Input | Reference | What we took from it | Source |
|---|---|---|---|
| Jira initiative | AQPI-1 | [Initiative] Intelligent Hotel Shopping and Reservation Experience; 8 statements | pulled from GitHub |
| Jira epic | AQPI-2, AQPI-6, AQPI-10, AQPI-14, AQPI-18, AQPI-23, AQPI-27 | 7 epics: [Epic 1] Search and Availability; [Epic 2] Hotel Results and Selection; [Epic 3] Personalized Ancillary Offers; [Epic 4] Cart Management; [Epic 5] Checkout and Reservation; [Epic 6] Confirmation and Notifications; [Epic 7] Cross-Cutting Quality, Privacy and Observability; 137 statements | pulled from GitHub |
| Codebase | sri465inno/uc-agentic-quality-engineering@demo/hotel-booking-platform (35af1ef) | AQPI-1 Intelligent Hotel Shopping and Reservation Experience: reactive Spring Boot microservices; 7 statements | pulled from GitHub |

## 3. How we ran the cycle
1. Read 152 statements from the inputs and lined them up into 128 requirement groups: 0 agreed by every source, 121 only in Jira, 7 only in the code, 0 in conflict.
2. The review agent read the inputs first and suggested 7 addition(s), 184 missing piece(s) and 0 conflict(s) for the reviewer (8 high severity). It approved nothing.
3. Priya Shah reviewed and approved the requirement set on 2026-10-02 15:08 UTC.
4. Regression testing steered the design: No earlier pack exists, so it designs the full regression pack (functional and cross-cutting quality) and runs it. Result: 137 case(s) in this run (0 reused, 0 re-designed, 137 new).
5. Derived 128 business rules (each quoting its source), designed 137 test cases (128 functional, 9 non-functional) and generated 58 Playwright scripts.
6. Executed the automated suite with Playwright 1.63.0 (headless Chromium, JSON reporter) against Hotel booking platform release 1.0, six Spring Boot services built from branch demo/hotel-booking-platform; defects were raised only for tests that actually failed.

## 4. Artifacts produced
| Artifact | Count | Notes | Folder |
|---|---|---|---|
| Inputs and provenance | 3 | what was taken from each source, and where from | [01-inputs/](01-inputs/) |
| Review agent suggestions | 191 | 7 added · 184 missing · 0 conflicts (advisory) | [01-inputs/review-agent.json](01-inputs/review-agent.json) |
| Normalised requirement set | 128 | 0 agreed · 121 Jira-only · 7 code-only · 0 conflicts | [01-inputs/normalisation.json](01-inputs/normalisation.json) |
| Requirements repository | 128 | 128 new | [02-requirements/](02-requirements/) |
| Business rules | 128 | 65 executable, each with a source quote | [03-business-rules/](03-business-rules/) |
| Test cases (Excel, Zephyr Scale format) | 137 | 74 automated · 63 not automated | [04-test-cases/](04-test-cases/) |
| Test data (one data set per test case) | 137 | 129 conform to Hotel booking attributes v1.0 (21 attributes) · 8 negative tests | [05-test-data/](05-test-data/) |
| Automation scripts (Playwright) | 58 | 58 new | [06-automation-scripts/](06-automation-scripts/) |
| Execution results and evidence | 74 | 74 passed · 0 failed · 63 manual | [07-execution/](07-execution/) |
| Defects | 0 | none | [08-defects/](08-defects/) |
| Cycle report (HTML, Excel) | 1 | full detail behind this summary | [09-report/](09-report/) |

## 5. Risks and open items
- 7 requirements had no case in this regression testing run (REQ-001, REQ-002, REQ-004, REQ-005, REQ-006, REQ-007, REQ-051); a wider run is needed before release.
- Review agent (RA-10): Asked for in Jira but not mentioned in the code. Tests are designed from the Jira wording; expect them to fail until it is built, or confirm with the developers where it lives.
- Review agent (RA-12): Asked for in Jira but not mentioned in the code. Tests are designed from the Jira wording; expect them to fail until it is built, or confirm with the developers where it lives.
- Review agent (RA-71): Asked for in Jira but not mentioned in the code. Tests are designed from the Jira wording; expect them to fail until it is built, or confirm with the developers where it lives.
- Review agent (RA-82): Asked for in Jira but not mentioned in the code. Tests are designed from the Jira wording; expect them to fail until it is built, or confirm with the developers where it lives.
- Review agent (RA-84): Asked for in Jira but not mentioned in the code. Tests are designed from the Jira wording; expect them to fail until it is built, or confirm with the developers where it lives.
- Review agent (RA-88): Asked for in Jira but not mentioned in the code. Tests are designed from the Jira wording; expect them to fail until it is built, or confirm with the developers where it lives.
- Review agent (RA-89): Asked for in Jira but not mentioned in the code. Tests are designed from the Jira wording; expect them to fail until it is built, or confirm with the developers where it lives.
- 63 test cases cannot be automated and were not executed: TC-F-002 Verify: Required business and technical events are logged using approved identifiers and masking rules; TC-F-003 Verify: All child user stories meet their acceptance criteria and the Definition of Done; TC-F-004 Verify: Negative and error paths for each story are tested and evidenced; TC-F-005 Verify: Required logging is in place and verified free of sensitive data; TC-F-006 Verify: The Product Owner has accepted the capability end to end; TC-F-012 Verify: Check-in must precede check-out; TC-F-013 Verify: Occupancy must comply with configured room limits; TC-F-014 Verify: Maximum stay length must be configurable; TC-F-017 Verify: Server validation is authoritative when client and server results differ; TC-N-002 Verify: Validation messages are accessible to assistive technology; TC-F-018 Verify: Validation rules must be configurable where market or property rules vary; TC-F-020 Verify: Technical failures display a non-technical message and retry option; TC-F-029 Verify: Selected criteria are visible and removable; TC-F-032 Verify: The guest can select a valid room and rate plan; TC-F-033 Verify: If inventory changes, the guest is informed before continuing; TC-F-035 Verify: The service considers available context such as stay dates, season, destination, hotel, room, party composition, declared interests, and consented profile attributes; TC-F-038 Verify: When personalization data is unavailable, safe contextual defaults may be returned; TC-F-039 Verify: Sensitive traits must not be inferred or used; TC-F-040 Verify: Personalization must honor consent and data-retention rules; TC-F-041 Verify: Business rules and model versions must be auditable; TC-F-045 Verify: The interface identifies when offers are personalized where required; TC-F-049 Verify: Inventory and price are revalidated when required; TC-F-050 Verify: The cart has a defined expiration and displays relevant timeout behavior; TC-F-051 Verify: A cart must not itself create a reservation; TC-F-052 Verify: Price-change handling must require guest acknowledgement when material; TC-F-053 Verify: The guest can add an available ancillary; TC-F-056 Verify: Ineligible or sold-out products cannot be retained silently; TC-F-058 Verify: Currency is consistently displayed; TC-F-059 Verify: Material changes are highlighted and require acknowledgement; TC-F-060 Verify: The guest can return to edit supported selections; TC-F-061 Verify: The final payable total must be revalidated before reservation submission; TC-F-064 Verify: Data is transmitted securely and is not exposed in client logs; TC-F-065 Verify: Data minimization applies; TC-F-069 Verify: Payment data is handled through approved secure components; TC-F-074 Verify: Payment requirements depend on rate conditions; TC-F-075 Verify: Retry behavior must avoid duplicate authorization; TC-F-079 Verify: Partial failures trigger defined recovery or manual-review handling; TC-F-080 Verify: Reservation submission must use an idempotency mechanism; TC-F-081 Verify: The source of truth for confirmation status must be defined; TC-N-005 Verify: Templates support required locale and accessibility standards; TC-F-087 Verify: Only necessary personal data may be included; TC-F-089 Verify: A successful reservation creates one confirmation-email request; TC-F-091 Verify: Permitted retries avoid duplicate or excessive messages; TC-F-092 Verify: Operational users can distinguish queued, sent, delivered, bounced, and failed states when supported by the provider; TC-F-093 Verify: Email addresses must be masked outside authorized operational views; TC-F-095 Verify: Rate limits and abuse controls apply; TC-F-096 Verify: The resend creates a new message event without creating a new reservation; TC-F-097 Verify: Sensitive data is classified and mapped to approved storage and processing locations; TC-F-098 Verify: Data is encrypted in transit and at rest where required; TC-F-099 Verify: Logs and analytics exclude or mask prohibited fields; TC-F-101 Verify: Retention and deletion follow approved policy; TC-F-103 Verify: Business events and technical logs are distinguishable; TC-N-006 Verify: Metrics and alerts exist for agreed critical failures and latency; TC-F-104 Verify: Logging degradation does not expose sensitive payloads or silently block booking unless explicitly required; TC-F-105 Verify: Event schemas must be versioned; TC-F-106 Verify: Production log access must be controlled and retained according to policy; TC-N-007 Verify: Keyboard navigation, focus order, labels, instructions, status messaging, and error handling are accessible; TC-F-107 Verify: Visual information is not conveyed by color alone; TC-F-108 Verify: Dynamic updates are announced appropriately; TC-N-009 Verify: Search, pricing, cart, checkout, reservation, and email dependencies have agreed performance targets; TC-F-109 Verify: Timeout, retry, circuit-breaker, and fallback behavior are documented; TC-F-110 Verify: Load, resilience, and recovery tests cover critical journeys; TC-F-111 Verify: Reservation integrity is prioritized over non-critical personalization and analytics. Needs a manual run before sign-off.
- 70 requirements not yet verified by a passing test: REQ-001 (not covered); REQ-002 (not covered); REQ-004 (not covered); REQ-005 (not covered); REQ-006 (not covered); REQ-007 (not covered); REQ-008 (designed only (manual)); REQ-009 (designed only (manual)); REQ-010 (designed only (manual)); REQ-011 (designed only (manual)); REQ-012 (designed only (manual)); REQ-017 (designed only (manual)); REQ-018 (designed only (manual)); REQ-019 (designed only (manual)); REQ-022 (designed only (manual)); REQ-023 (designed only (manual)); REQ-024 (designed only (manual)); REQ-026 (designed only (manual)); REQ-035 (designed only (manual)); REQ-038 (designed only (manual)); REQ-039 (designed only (manual)); REQ-041 (designed only (manual)); REQ-044 (designed only (manual)); REQ-045 (designed only (manual)); REQ-046 (designed only (manual)); REQ-047 (designed only (manual)); REQ-051 (not covered); REQ-052 (designed only (manual)); REQ-056 (designed only (manual)); REQ-057 (designed only (manual)); REQ-058 (designed only (manual)); REQ-059 (designed only (manual)); REQ-060 (designed only (manual)); REQ-063 (designed only (manual)); REQ-065 (designed only (manual)); REQ-066 (designed only (manual)); REQ-067 (designed only (manual)); REQ-068 (designed only (manual)); REQ-072 (designed only (manual)); REQ-073 (designed only (manual)); REQ-076 (designed only (manual)); REQ-079 (designed only (manual)); REQ-080 (designed only (manual)); REQ-084 (designed only (manual)); REQ-085 (designed only (manual)); REQ-086 (designed only (manual)); REQ-092 (designed only (manual)); REQ-093 (designed only (manual)); REQ-095 (designed only (manual)); REQ-097 (designed only (manual)); REQ-098 (designed only (manual)); REQ-099 (designed only (manual)); REQ-101 (designed only (manual)); REQ-102 (designed only (manual)); REQ-103 (designed only (manual)); REQ-104 (designed only (manual)); REQ-105 (designed only (manual)); REQ-107 (designed only (manual)); REQ-109 (designed only (manual)); REQ-110 (designed only (manual)); REQ-111 (designed only (manual)); REQ-112 (designed only (manual)); REQ-113 (designed only (manual)); REQ-114 (designed only (manual)); REQ-115 (designed only (manual)); REQ-116 (designed only (manual)); REQ-118 (designed only (manual)); REQ-119 (designed only (manual)); REQ-120 (designed only (manual)); REQ-121 (designed only (manual)).
- 128 requirement groups come from a single source only; the product owner should confirm them.

_13 of 15 booking-driving attributes (out of 21 booking attributes) are varied by at least one test._

## 6. Recommendation and next steps
**Conditional go.** No release-blocking defects, but there are open items to accept or close.

- Cover or accept 70 requirements not yet verified by a passing test.
- Run TC-F-002, TC-F-003, TC-F-004, TC-F-005, TC-F-006, TC-F-012, TC-F-013, TC-F-014, TC-F-017, TC-N-002, TC-F-018, TC-F-020, TC-F-029, TC-F-032, TC-F-033, TC-F-035, TC-F-038, TC-F-039, TC-F-040, TC-F-041, TC-F-045, TC-F-049, TC-F-050, TC-F-051, TC-F-052, TC-F-053, TC-F-056, TC-F-058, TC-F-059, TC-F-060, TC-F-061, TC-F-064, TC-F-065, TC-F-069, TC-F-074, TC-F-075, TC-F-079, TC-F-080, TC-F-081, TC-N-005, TC-F-087, TC-F-089, TC-F-091, TC-F-092, TC-F-093, TC-F-095, TC-F-096, TC-F-097, TC-F-098, TC-F-099, TC-F-101, TC-F-103, TC-N-006, TC-F-104, TC-F-105, TC-F-106, TC-N-007, TC-F-107, TC-F-108, TC-N-009, TC-F-109, TC-F-110, TC-F-111 manually and record the result.
- Use this approved baseline as the reference for the next incremental cycle.

## 7. Sign-off
| Gate | Decision | By | When | Detail |
|---|---|---|---|---|
| Requirement set review | approved | Priya Shah | 2026-10-02 15:08 UTC | 128 requirements approved; 0 excluded; 0 conflict(s) resolved |

_Agentic QE Platform (QE lead report, computed from the cycle) · generated 2026-10-02 15:08 UTC. Every figure comes from the persisted cycle; nothing is estimated._

## Appendix A: test results (real Playwright run)
| Key | Test | Result | ms |
|---|---|---|---|
| TC-F-001 | The payment summary shows taxes, mandatory fees and the total before booking | passed | 538 |
| TC-F-002 | Verify: Required business and technical events are logged using approved identifiers and masking rules | not-run | 0 |
| TC-F-003 | Verify: All child user stories meet their acceptance criteria and the Definition of Done | not-run | 0 |
| TC-F-004 | Verify: Negative and error paths for each story are tested and evidenced | not-run | 0 |
| TC-F-005 | Verify: Required logging is in place and verified free of sensitive data | not-run | 0 |
| TC-F-006 | Verify: The Product Owner has accepted the capability end to end | not-run | 0 |
| TC-F-007 | A valid search returns available hotels for the destination | passed | 206 |
| TC-F-008 | The results page returns the criteria the guest submitted | passed | 59 |
| TC-F-009 | A check-in date in the past is rejected | passed | 49 |
| TC-F-010 | A check-out on the check-in day is rejected | passed | 38 |
| TC-F-011 | A search without a destination is rejected | passed | 31 |
| TC-N-001 | When every hotel is sold out the guest is told and offered other dates, guests or destination | passed | 55 |
| TC-F-012 | Verify: Check-in must precede check-out | not-run | 0 |
| TC-F-013 | Verify: Occupancy must comply with configured room limits | not-run | 0 |
| TC-F-014 | Verify: Maximum stay length must be configurable | not-run | 0 |
| TC-F-015 | The search form marks destination, dates, rooms and adults as required | passed | 23 |
| TC-F-016 | Two rooms for one adult return a message on the adults field | passed | 19 |
| TC-F-017 | Verify: Server validation is authoritative when client and server results differ | not-run | 0 |
| TC-N-002 | Verify: Validation messages are accessible to assistive technology | not-run | 0 |
| TC-F-018 | Verify: Validation rules must be configurable where market or property rules vary | not-run | 0 |
| TC-F-019 | When every hotel is sold out the guest is told and offered other dates, guests or destination | passed | 37 |
| TC-F-020 | Verify: Technical failures display a non-technical message and retry option | not-run | 0 |
| TC-F-021 | Submitting the same search twice in one session returns the same search | passed | 36 |
| TC-N-003 | Every result has a name, location, image, availability and, when bookable, a starting price in a currency | passed | 24 |
| TC-F-022 | Every bookable result states what its price includes | passed | 23 |
| TC-F-023 | A sold-out hotel is listed as SOLD_OUT without a price | passed | 26 |
| TC-F-024 | Results can be read two at a time | passed | 42 |
| TC-F-025 | The starting price equals the cheapest rate on the hotel page | passed | 34 |
| TC-F-026 | Filtering by the spa amenity returns only hotels with a spa | passed | 38 |
| TC-F-027 | Sorting by lowest price orders bookable hotels by starting price | passed | 32 |
| TC-F-028 | An unapproved sort option is refused with a clear message | passed | 53 |
| TC-F-029 | Verify: Selected criteria are visible and removable | not-run | 0 |
| TC-F-030 | A filter that leaves no hotels offers a reset | passed | 28 |
| TC-F-031 | The hotel page shows description, images, address, amenities, rooms with prices and policies | passed | 16 |
| TC-F-032 | Verify: The guest can select a valid room and rate plan | not-run | 0 |
| TC-F-033 | Verify: If inventory changes, the guest is informed before continuing | not-run | 0 |
| TC-F-034 | Every rate plan states its cancellation terms and payment rule | passed | 23 |
| TC-F-035 | Verify: The service considers available context such as stay dates, season, destination, hotel, room, party composition, declared interests, and consented profile attributes | not-run | 0 |
| TC-F-036 | Spa access is not offered at a hotel without a spa | passed | 123 |
| TC-F-037 | Every recommended extra carries at least one reason code | passed | 19 |
| TC-F-038 | Verify: When personalization data is unavailable, safe contextual defaults may be returned | not-run | 0 |
| TC-F-039 | Verify: Sensitive traits must not be inferred or used | not-run | 0 |
| TC-F-040 | Verify: Personalization must honor consent and data-retention rules | not-run | 0 |
| TC-F-041 | Verify: Business rules and model versions must be auditable | not-run | 0 |
| TC-F-042 | Each offer shows name, description, price and currency and is labelled an optional extra | passed | 21 |
| TC-F-043 | The guest can record add, skip and dismiss on an offer | passed | 26 |
| TC-F-044 | Each offer shows name, description, price and currency and is labelled an optional extra | passed | 22 |
| TC-F-045 | Verify: The interface identifies when offers are personalized where required | not-run | 0 |
| TC-F-046 | A room books without any extra | passed | 230 |
| TC-F-047 | Withdrawing consent stops personalized offers | passed | 36 |
| TC-F-048 | The cart holds the selected hotel, room, rate, dates, occupancy and price components | passed | 25 |
| TC-F-049 | Verify: Inventory and price are revalidated when required | not-run | 0 |
| TC-F-050 | Verify: The cart has a defined expiration and displays relevant timeout behavior | not-run | 0 |
| TC-F-051 | Verify: A cart must not itself create a reservation | not-run | 0 |
| TC-F-052 | Verify: Price-change handling must require guest acknowledgement when material | not-run | 0 |
| TC-F-053 | Verify: The guest can add an available ancillary | not-run | 0 |
| TC-F-054 | Breakfast can go to 2 but not above its limit of 4 | passed | 90 |
| TC-F-055 | Removing breakfast returns the total to the room-only amount | passed | 36 |
| TC-F-056 | Verify: Ineligible or sold-out products cannot be retained silently | not-run | 0 |
| TC-F-057 | The cart itemises room, taxes, fees, extras and discounts and they add up to the total | passed | 37 |
| TC-F-058 | Verify: Currency is consistently displayed | not-run | 0 |
| TC-F-059 | Verify: Material changes are highlighted and require acknowledgement | not-run | 0 |
| TC-F-060 | Verify: The guest can return to edit supported selections | not-run | 0 |
| TC-F-061 | Verify: The final payable total must be revalidated before reservation submission | not-run | 0 |
| TC-F-062 | Checkout lists name, e-mail, payment and privacy notice as required and phone as optional | passed | 39 |
| TC-N-004 | An invalid e-mail address is rejected on the e-mail field | passed | 36 |
| TC-F-063 | Booking without accepting the privacy notice is refused | passed | 25 |
| TC-F-064 | Verify: Data is transmitted securely and is not exposed in client logs | not-run | 0 |
| TC-F-065 | Verify: Data minimization applies | not-run | 0 |
| TC-F-066 | Support staff see a masked e-mail and other callers are refused | passed | 63 |
| TC-F-067 | A pay-at-hotel rate shows nothing to pay now and the total due at the hotel | passed | 33 |
| TC-F-068 | A prepaid rate shows the full total to pay now | passed | 31 |
| TC-F-069 | Verify: Payment data is handled through approved secure components | not-run | 0 |
| TC-F-070 | A declined card returns a decline without a booking | passed | 41 |
| TC-F-071 | A lost payment response leaves the booking pending and tells the guest not to resubmit | passed | 51 |
| TC-F-072 | A payment provider failure returns a failure without a booking | passed | 35 |
| TC-F-073 | A raw card number is refused and never echoed back | passed | 23 |
| TC-F-074 | Verify: Payment requirements depend on rate conditions | not-run | 0 |
| TC-F-075 | Verify: Retry behavior must avoid duplicate authorization | not-run | 0 |
| TC-F-076 | A successful booking creates one reservation with a confirmation number | passed | 50 |
| TC-F-077 | Resubmitting with the same key returns the original reservation | passed | 55 |
| TC-F-078 | After a booking and a decline the reconciliation report is consistent | passed | 73 |
| TC-F-079 | Verify: Partial failures trigger defined recovery or manual-review handling | not-run | 0 |
| TC-F-080 | Verify: Reservation submission must use an idempotency mechanism | not-run | 0 |
| TC-F-081 | Verify: The source of truth for confirmation status must be defined | not-run | 0 |
| TC-F-082 | The success outcome shows confirmation number, hotel, stay, extras and total | passed | 53 |
| TC-F-083 | A declined payment does not say the booking is confirmed | passed | 27 |
| TC-F-084 | A pending outcome tells the guest not to resubmit and how to check later | passed | 29 |
| TC-F-085 | The confirmation e-mail matches the booking and contains no payment token | passed | 46 |
| TC-F-086 | The confirmation e-mail matches the booking and contains no payment token | passed | 44 |
| TC-N-005 | Verify: Templates support required locale and accessibility standards | not-run | 0 |
| TC-F-087 | Verify: Only necessary personal data may be included | not-run | 0 |
| TC-F-088 | The confirmation e-mail matches the booking and contains no payment token | passed | 41 |
| TC-F-089 | Verify: A successful reservation creates one confirmation-email request | not-run | 0 |
| TC-F-090 | When the e-mail cannot be sent the booking stays confirmed | passed | 137 |
| TC-F-091 | Verify: Permitted retries avoid duplicate or excessive messages | not-run | 0 |
| TC-F-092 | Verify: Operational users can distinguish queued, sent, delivered, bounced, and failed states when supported by the provider | not-run | 0 |
| TC-F-093 | Verify: Email addresses must be masked outside authorized operational views | not-run | 0 |
| TC-F-094 | A resend with the wrong last name gets the same answer as a correct one | passed | 61 |
| TC-F-095 | Verify: Rate limits and abuse controls apply | not-run | 0 |
| TC-F-096 | Verify: The resend creates a new message event without creating a new reservation | not-run | 0 |
| TC-F-097 | Verify: Sensitive data is classified and mapped to approved storage and processing locations | not-run | 0 |
| TC-F-098 | Verify: Data is encrypted in transit and at rest where required | not-run | 0 |
| TC-F-099 | Verify: Logs and analytics exclude or mask prohibited fields | not-run | 0 |
| TC-F-100 | Support staff see a masked e-mail and other callers are refused | passed | 43 |
| TC-F-101 | Verify: Retention and deletion follow approved policy | not-run | 0 |
| TC-F-102 | A correlation ID sent by the client is returned by search, cart and reservation | passed | 47 |
| TC-F-103 | Verify: Business events and technical logs are distinguishable | not-run | 0 |
| TC-N-006 | Verify: Metrics and alerts exist for agreed critical failures and latency | not-run | 0 |
| TC-F-104 | Verify: Logging degradation does not expose sensitive payloads or silently block booking unless explicitly required | not-run | 0 |
| TC-F-105 | Verify: Event schemas must be versioned | not-run | 0 |
| TC-F-106 | Verify: Production log access must be controlled and retained according to policy | not-run | 0 |
| TC-N-007 | Verify: Keyboard navigation, focus order, labels, instructions, status messaging, and error handling are accessible | not-run | 0 |
| TC-F-107 | Verify: Visual information is not conveyed by color alone | not-run | 0 |
| TC-F-108 | Verify: Dynamic updates are announced appropriately | not-run | 0 |
| TC-N-008 | The confirmation e-mail has a language, a heading, a captioned table with scoped headers and a text part | passed | 40 |
| TC-N-009 | Verify: Search, pricing, cart, checkout, reservation, and email dependencies have agreed performance targets | not-run | 0 |
| TC-F-109 | Verify: Timeout, retry, circuit-breaker, and fallback behavior are documented | not-run | 0 |
| TC-F-110 | Verify: Load, resilience, and recovery tests cover critical journeys | not-run | 0 |
| TC-F-111 | Verify: Reservation integrity is prioritized over non-critical personalization and analytics | not-run | 0 |
| TC-F-112 | A new cart expires 30 minutes after creation and reserves nothing | passed | 18 |
| TC-F-113 | A price rise above 1% blocks booking until the guest acknowledges it | passed | 77 |
| TC-F-114 | A price change within 1% does not need acknowledgement | passed | 22 |
| TC-F-115 | The 4th resend within 24 hours is refused | passed | 63 |
| TC-F-116 | A reservation without an Idempotency-Key is refused | passed | 20 |
| TC-F-117 | A key shorter than 8 characters is refused | passed | 19 |
| TC-F-118 | Reusing a key for a different cart is refused | passed | 43 |
| TC-F-119 | A 30-night stay is accepted | passed | 21 |
| TC-F-120 | A 31-night stay is rejected | passed | 19 |
| TC-F-121 | A 21-night stay in Paris is accepted | passed | 17 |
| TC-F-122 | A 22-night stay in Paris is rejected | passed | 15 |
| TC-F-123 | 4 adults in one room are accepted | passed | 16 |
| TC-F-124 | 5 adults in one room are rejected | passed | 14 |
| TC-F-125 | 4 children in one room are rejected | passed | 14 |
| TC-F-126 | 9 rooms in one search are rejected | passed | 13 |
| TC-F-127 | A check-in 500 days ahead is accepted | passed | 16 |
| TC-F-128 | A check-in 501 days ahead is rejected | passed | 13 |

## Appendix B: requirements
| ID | Requirement | Status |
|---|---|---|
| REQ-001 | A guest can complete the complete search-to-confirmation flow using valid inputs. | new |
| REQ-002 | Only bookable inventory and valid rates are presented as available. | new |
| REQ-003 | Total price is disclosed before confirmation, including mandatory taxes and fees. | new |
| REQ-004 | Ancillary offers do not block booking when declined or unavailable. | new |
| REQ-005 | The platform prevents or safely handles duplicate reservation submissions. | new |
| REQ-006 | A successful reservation produces a durable confirmation identifier. | new |
| REQ-007 | Confirmation is displayed on screen and an email request is generated. | new |
| REQ-008 | Required business and technical events are logged using approved identifiers and masking rules. | new |
| REQ-009 | All child user stories meet their acceptance criteria and the Definition of Done. | new |
| REQ-010 | Negative and error paths for each story are tested and evidenced. | new |
| REQ-011 | Required logging is in place and verified free of sensitive data. | new |
| REQ-012 | The Product Owner has accepted the capability end to end. | new |
| REQ-013 | Given valid search criteria, when the guest submits the search, then a search request is created and matching available hotels are returned. | new |
| REQ-014 | The submitted criteria remain visible and editable on the results page. | new |
| REQ-015 | Past check-in dates, check-out dates not after check-in, and missing mandatory fields are rejected with actionable messages. | new |
| REQ-016 | A no-availability result explains that no matching inventory was found and allows criteria changes. | new |
| REQ-017 | Check-in must precede check-out. | new |
| REQ-018 | Occupancy must comply with configured room limits. | new |
| REQ-019 | Maximum stay length must be configurable. | new |
| REQ-020 | Required fields are clearly identified. | new |
| REQ-021 | Invalid combinations return field-level messages. | new |
| REQ-022 | Server validation is authoritative when client and server results differ. | new |
| REQ-023 | Validation messages are accessible to assistive technology. | new |
| REQ-024 | Validation rules must be configurable where market or property rules vary. | new |
| REQ-025 | Zero results provide options to alter dates, occupancy, destination, or filters. | new |
| REQ-026 | Technical failures display a non-technical message and retry option. | new |
| REQ-027 | Repeated submission does not create inconsistent sessions. | new |
| REQ-028 | Each result shows hotel name, location, representative image, starting price, currency, and availability indicator. | new |
| REQ-029 | Mandatory fees or pricing qualifications are clearly disclosed. | new |
| REQ-030 | Unavailable hotels are not presented as immediately bookable. | new |
| REQ-031 | Results support pagination or progressive loading. | new |
| REQ-032 | Displayed starting price must correspond to a valid rate returned for the search criteria. | new |
| REQ-033 | The guest can apply supported filters such as price range, amenities, hotel category, and distance when data is available. | new |
| REQ-034 | The guest can sort using approved options. | new |
| REQ-035 | Selected criteria are visible and removable. | new |
| REQ-036 | Zero results after filtering offer a reset option. | new |
| REQ-037 | Hotel description, images, location, amenities, room options, pricing, major policies, and relevant restrictions are displayed. | new |
| REQ-038 | The guest can select a valid room and rate plan. | new |
| REQ-039 | If inventory changes, the guest is informed before continuing. | new |
| REQ-040 | Rate conditions and cancellation terms must be shown before selection. | new |
| REQ-041 | The service considers available context such as stay dates, season, destination, hotel, room, party composition, declared interests, and consented profile attributes. | new |
| REQ-042 | Unavailable or ineligible products are excluded. | new |
| REQ-043 | The service returns a reason code for each recommended item. | new |
| REQ-044 | When personalization data is unavailable, safe contextual defaults may be returned. | new |
| REQ-045 | Sensitive traits must not be inferred or used. | new |
| REQ-046 | Personalization must honor consent and data-retention rules. | new |
| REQ-047 | Business rules and model versions must be auditable. | new |
| REQ-048 | Each offer shows name, description, price, currency, applicability, and any restrictions. | new |
| REQ-049 | The guest can add, skip, or dismiss an offer. | new |
| REQ-050 | Offers are clearly distinguished from mandatory fees. | new |
| REQ-051 | Failure to load offers does not block room booking. | new |
| REQ-052 | The interface identifies when offers are personalized where required. | new |
| REQ-053 | The guest can proceed without selecting ancillary products. | new |
| REQ-054 | A consent or preference change affects future eligible recommendations according to policy. | new |
| REQ-055 | The cart contains hotel, room, rate plan, stay dates, occupancy, quantity, currency, and price components. | new |
| REQ-056 | Inventory and price are revalidated when required. | new |
| REQ-057 | The cart has a defined expiration and displays relevant timeout behavior. | new |
| REQ-058 | A cart must not itself create a reservation. | new |
| REQ-059 | Price-change handling must require guest acknowledgement when material. | new |
| REQ-060 | The guest can add an available ancillary. | new |
| REQ-061 | Supported quantities can be changed within product limits. | new |
| REQ-062 | Removal updates totals immediately. | new |
| REQ-063 | Ineligible or sold-out products cannot be retained silently. | new |
| REQ-064 | Room charges, taxes, mandatory fees, optional products, discounts, and total are itemized. | new |
| REQ-065 | Currency is consistently displayed. | new |
| REQ-066 | Material changes are highlighted and require acknowledgement. | new |
| REQ-067 | The guest can return to edit supported selections. | new |
| REQ-068 | The final payable total must be revalidated before reservation submission. | new |
| REQ-069 | Required and optional fields are clearly distinguished. | new |
| REQ-070 | Inputs are validated and error messages are accessible. | new |
| REQ-071 | The guest receives applicable privacy notice and consent controls. | new |
| REQ-072 | Data is transmitted securely and is not exposed in client logs. | new |
| REQ-073 | Data minimization applies. | new |
| REQ-074 | Sensitive values must be masked in support tools and excluded from analytics logs. | new |
| REQ-075 | The guest sees the final payable or guarantee amount before authorization. | new |
| REQ-076 | Payment data is handled through approved secure components. | new |
| REQ-077 | Authorization success, decline, timeout, and technical failure are handled distinctly. | new |
| REQ-078 | The product does not store prohibited card data in application logs. | new |
| REQ-079 | Payment requirements depend on rate conditions. | new |
| REQ-080 | Retry behavior must avoid duplicate authorization. | new |
| REQ-081 | A successful request creates one reservation and returns a confirmation identifier. | new |
| REQ-082 | Repeated submissions with the same idempotency key do not create duplicate reservations. | new |
| REQ-083 | Inventory, price, payment, and reservation outcomes remain reconcilable. | new |
| REQ-084 | Partial failures trigger defined recovery or manual-review handling. | new |
| REQ-085 | Reservation submission must use an idempotency mechanism. | new |
| REQ-086 | The source of truth for confirmation status must be defined. | new |
| REQ-087 | Success displays confirmation identifier, hotel, stay summary, selected products, and total. | new |
| REQ-088 | A failure does not display a false confirmation. | new |
| REQ-089 | Unknown or timeout states instruct the guest not to resubmit blindly and provide a safe recovery path. | new |
| REQ-090 | The message contains guest-safe confirmation details, hotel information, stay dates, booked items, pricing summary, and applicable policy information. | new |
| REQ-091 | The message content matches the confirmed reservation state. | new |
| REQ-092 | Templates support required locale and accessibility standards. | new |
| REQ-093 | Only necessary personal data may be included. | new |
| REQ-094 | Sensitive payment details must not appear. | new |
| REQ-095 | A successful reservation creates one confirmation-email request. | new |
| REQ-096 | Send failure does not reverse a valid reservation. | new |
| REQ-097 | Permitted retries avoid duplicate or excessive messages. | new |
| REQ-098 | Operational users can distinguish queued, sent, delivered, bounced, and failed states when supported by the provider. | new |
| REQ-099 | Email addresses must be masked outside authorized operational views. | new |
| REQ-100 | The request verifies sufficient reservation information without exposing data. | new |
| REQ-101 | Rate limits and abuse controls apply. | new |
| REQ-102 | The resend creates a new message event without creating a new reservation. | new |
| REQ-103 | Sensitive data is classified and mapped to approved storage and processing locations. | new |
| REQ-104 | Data is encrypted in transit and at rest where required. | new |
| REQ-105 | Logs and analytics exclude or mask prohibited fields. | new |
| REQ-106 | Access to operational data is role-based and auditable. | new |
| REQ-107 | Retention and deletion follow approved policy. | new |
| REQ-108 | Events use a correlation ID across supported services. | new |
| REQ-109 | Business events and technical logs are distinguishable. | new |
| REQ-110 | Metrics and alerts exist for agreed critical failures and latency. | new |
| REQ-111 | Logging degradation does not expose sensitive payloads or silently block booking unless explicitly required. | new |
| REQ-112 | Event schemas must be versioned. | new |
| REQ-113 | Production log access must be controlled and retained according to policy. | new |
| REQ-114 | Keyboard navigation, focus order, labels, instructions, status messaging, and error handling are accessible. | new |
| REQ-115 | Visual information is not conveyed by color alone. | new |
| REQ-116 | Dynamic updates are announced appropriately. | new |
| REQ-117 | Email templates are readable and structurally accessible. | new |
| REQ-118 | Search, pricing, cart, checkout, reservation, and email dependencies have agreed performance targets. | new |
| REQ-119 | Timeout, retry, circuit-breaker, and fallback behavior are documented. | new |
| REQ-120 | Load, resilience, and recovery tests cover critical journeys. | new |
| REQ-121 | Reservation integrity is prioritized over non-critical personalization and analytics. | new |
| REQ-122 | A cart expires 30 minutes after it is created and never creates a reservation itself. | new |
| REQ-123 | A price change of more than 1% must be acknowledged by the guest before checkout. | new |
| REQ-124 | A confirmation can be resent at most 3 times per booking in 24 hours. | new |
| REQ-125 | Every reservation request needs an Idempotency-Key of 8 to 64 characters; a replay within 24 hours returns the original outcome. | new |
| REQ-126 | A stay can be at most 30 nights; Paris (PAR) allows at most 21 nights. | new |
| REQ-127 | Each room holds at most 4 adults and 3 children, and one search books 1 to 8 rooms. | new |
| REQ-128 | Check-in can be at most 500 days ahead. | new |
