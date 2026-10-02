# QE lead report - Hotel booking baseline · End-to-end

CYC-3 · baseline cycle

> **Recommendation: Conditional go.** No release-blocking defects, but there are open items to accept or close.

| Type of testing | Requirements | Test cases | Automated | Pass rate | Defects | Requirements verified |
|---|---|---|---|---|---|---|
| End-to-end testing | 128 | 8 | 8 | 100% | 0 | 5.5% |

## 1. Summary
- Baseline cycle for Travel-advisor commission calculated from reservation attributes on build demo/hotel-booking-platform, 2026-10-02 03:54 UTC.
- Type of testing: End-to-end testing. The travel advisor's experience: store a reservation, open the commission statement in the browser and check every line and the total they see.
- We took 3 inputs (Jira initiative AQPI-1, Jira epic AQPI-2, AQPI-6, AQPI-10, AQPI-14, AQPI-18, AQPI-23, AQPI-27, Codebase sri465inno/uc-agentic-quality-engineering@demo/hotel-booking-platform (35af1ef)) and produced 128 requirements, 8 test cases and 7 automated scripts.
- We ran 8 automated tests for real: 8 passed, 0 failed (pass rate 100%). 
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
3. Priya Shah reviewed and approved the requirement set on 2026-10-02 03:54 UTC.
4. End-to-end testing steered the design: Designs one browser journey per money rule plus the statement screen check, and runs them in a real browser with screenshots. Result: 8 case(s) in this run (0 reused, 0 re-designed, 8 new).
5. Derived 128 business rules (each quoting its source), designed 8 test cases (8 functional) and generated 7 Playwright scripts.
6. Executed the automated suite with Playwright 1.63.0 (headless Chromium, JSON reporter) against Hotel booking platform, six Spring Boot services built from hotel-booking-platform/ (branch demo/hotel-booking-platform); defects were raised only for tests that actually failed.

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
| Defects | 0 | none | [08-defects/](08-defects/) |
| Cycle report (HTML, Excel) | 1 | full detail behind this summary | [09-report/](09-report/) |

## 5. Risks and open items
- End-to-end testing: No input describes the advisor screen, so the journeys check the statement page the codebase ships without a stated requirement for it.
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

_6 of 15 commission-driving attributes (out of 21 reservation attributes) are varied by at least one test._

## 6. Recommendation and next steps
**Conditional go.** No release-blocking defects, but there are open items to accept or close.

- Cover or accept 121 requirements not yet verified by a passing test.
- Use this approved baseline as the reference for the next incremental cycle.

## 7. Sign-off
| Gate | Decision | By | When | Detail |
|---|---|---|---|---|
| Requirement set review | approved | Priya Shah | 2026-10-02 03:54 UTC | 128 requirements approved; 0 excluded; 0 conflict(s) resolved |

_Agentic QE Platform (QE lead report, computed from the cycle) · generated 2026-10-02 03:54 UTC. Every figure comes from the persisted cycle; nothing is estimated._

## Appendix A: test results (real Playwright run)
| Key | Test | Result | ms |
|---|---|---|---|
| TC-F-001 | Guest books a pay-at-hotel room with breakfast from search to confirmation e-mail | passed | 1083 |
| TC-F-002 | Guest books a prepaid non-refundable room in Paris and pays now | passed | 109 |
| TC-F-003 | A sold-out hotel is shown as unavailable and cannot be put in a cart | passed | 69 |
| TC-F-004 | An unavailable extra is refused and the room still books | passed | 82 |
| TC-F-005 | A double-clicked Book button creates one reservation and one payment | passed | 58 |
| TC-F-006 | The confirmation number can be looked up again after booking | passed | 57 |
| TC-F-007 | The guest sees the booking outcome and one confirmation e-mail is created | passed | 55 |
| TC-F-008 | An unavailable extra is refused and the room still books | passed | 56 |

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
