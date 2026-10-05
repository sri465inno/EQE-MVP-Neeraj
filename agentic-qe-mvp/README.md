# Agentic QE Platform - MVP

A standalone MVP of the Agentic QE Platform. The platform chains **seven agents** (requirements, test design, test data, automation, execution, defects, reporting). The requirements agent normalises every input into one common requirement set, each requirement carrying its business rule, exact values and source quotes, so a BA, PO or QE reviews the functionality in one place and is built to take many input types (Jira, Confluence/BRDs, API contracts, existing test suites, defect history, designs...). This MVP implements exactly **three inputs** - a Jira initiative, a Jira epic and a codebase - and demonstrates two flows on one complex capability:

**Demo capability: Aurora hotel booking.** Inputs are the Jira initiative `AQPI-1` (7 epics, 23 stories) and a Java 21 / Spring Boot WebFlux codebase of six reactive microservices (`../hotel-booking-platform/`: hotel, search, offer, cart, reservation, notification on ports 8081-8086).

1. **Flow 1 - Baseline (release 1.0).** `AQPI-1` + its seven epics + codebase branch `demo/hotel-booking-platform` -> normalisation -> review agent -> human review -> design agents -> real execution against the running Java services. Functional and Regression cycles pass about 71/74 automated tests and End-to-end passes 8/8. The three planted defects are raised from real failures and linked to `AQPI-4` (nine-room search accepted), `AQPI-17` (0.5% price change needs acknowledgement) and `AQPI-21` (seven-character idempotency key accepted).
2. **Flow 2 - Incremental (release 2.0).** The approved functional baseline + new Epic 8 `AQPI-32` + revised Epic 6 `AQPI-23` (Jira snapshot `release-2.0`) + codebase branch `demo/hotel-booking-platform-v2` -> delta (unchanged / enhanced / new) -> execution waits for human merge approval -> about 79/83 pass. Two new defects (`AQPI-34` 15-night Paris stay accepted, `AQPI-25` fourth e-mail retry accepted); `AQPI-17` and `AQPI-21` stay open under their original defect IDs; the `AQPI-4` defect is fixed, retested and certified closed. Compare: 2 new, 2 still open, 1 resolved.

## Run

Prerequisites: Node 20+ (verified on 24), Java 21 (Temurin/OpenJDK) and Maven 3.9+ (verified with 3.9.16).

```bash
npm install
npx playwright install --with-deps chromium
npm run build:hotel      # mvn install of ../hotel-booking-platform (release 1.0 jars)
npm run build:hotel-v2   # clones demo/hotel-booking-platform-v2 into .hotel-builds/ and builds release 2.0
npm start                # http://localhost:3000  (PORT, DATA_DIR env vars optional)
npm test                 # acceptance tests (node --test)
npm run lint             # node --check on every JS file
```

In the browser, click **Reset the demo** first, then run Flow 1 and Flow 2 from the Run page.

To refresh the recorded copies after changing the demo branches:

```bash
npm run record-github -- demo/hotel-booking-platform demo/hotel-booking-platform-v2
npm run demo:inputs      # demo-inputs/ (downloadable Flow 1 / Flow 2 inputs)
npm run demo:artifacts   # demo-artifacts/ (sample reports, traceability, Excel)
```

## What is real and what is recorded

| Thing | Status |
| --- | --- |
| Jira initiative / epics | Jira REST API v3 JSON published on branch `demo/jira-export` of `sri465inno/EQE-MVP-Neeraj` (`jira/*.json`): the hotel backlog `AQPI-1` to `AQPI-36`, exported from the AQPI space on `tcs-team-ou6drgfr.atlassian.net`, plus the older synthetic `COM-*` test issues. The Run page reads this export from GitHub by default (`Jira export on GitHub`); a recorded copy is in `fixtures/jira` for offline runs (`recorded fixture`). Live Jira calls happen only when `JIRA_BASE_URL`, `JIRA_EMAIL` and `JIRA_API_TOKEN` are all set (`live Jira call`). |
| Codebase | The Java hotel booking platform on branches `demo/hotel-booking-platform` (1.0) and `demo/hotel-booking-platform-v2` (2.0) of the same repo. `github` mode does a shallow `git clone` of the branch (plus a diff against the baseline branch for v2); `sample` mode reads the recorded snapshot in `fixtures/github/<branch>` (GitHub REST API shapes), made by `npm run record-github`. Both are labelled. |
| Normalisation, delta, coverage, pass/fail, defects | Computed in code (`src/normalise.js`, `src/delta.js`, `src/coverage.js`, `src/execution.js`, `src/defects.js`) and covered by tests. |
| Execution | Real: generated specs are written to `data/runs/<cycle>/` and run by the Playwright CLI (headless) against the built Java services of the cycle's release (1.0 jars from `npm run build:hotel`, 2.0 from `npm run build:hotel-v2`); the JSON report is parsed. Without the built jars the execution phase fails with the reason and nothing is reported as passed. |
| Planted defects | Release 1.0 and 2.0 contain deliberate rule violations (see Flow 1 / Flow 2 above). Defects come only from real failed test runs, never from inserted records. |
| Jira defects | Without `JIRA_*` secrets defects stay in the platform with their story link and a ready payload, and the UI says so. With them, a defect is raised against the most specific story (`JIRA_DEFECT_ISSUE_TYPE` optional). |
| Stated limits | Manual test cases are not executed; the confirmation e-mail goes to a simulated provider; performance targets (`AQPI-31`) are not measured. |
| Prose | Without `ANTHROPIC_API_KEY` a deterministic template drafts the report narrative (demo mode). With a key the model drafts only that narrative. |

## Layout

- `src/platform.js` - the seven agents, platform input types vs the three MVP inputs, demo scenario
- `src/connectors` - Jira (live Jira, GitHub-hosted export, or fixture) and codebase (git clone of a GitHub branch, or recorded snapshot)
- `src/extract.js`, `src/text.js` - statement extraction and value parsing
- `src/normalise.js`, `src/delta.js` - deterministic comparison engines
- `src/agents` - requirements (with their business rules), test design and Playwright script generation
- `src/execution.js`, `src/defects.js`, `src/coverage.js` - real execution and its consequences
- `src/pipeline.js` - fixed-order cycle orchestration with review and merge gates
- `src/report.js`, `src/compare.js`, `src/excel.js` - report, comparison, xlsx exports
- `src/store.js` - JSON persistence under `data/` (survives restarts)
- `public/` - plain HTML/CSS/JS UI; `../hotel-booking-platform` - the release 1.0 Java codebase (system under test); `samples/commission-engine` - the retired commission example kept for its tests; `scripts/` - generators for the data dictionary, Jira export and recorded GitHub snapshots; `test/` - acceptance tests

## Skills

`skills/*.md` are markdown skill files with YAML front matter (`id`, `name`, `description`, `appliesTo`, `delivers`), loaded at startup by `src/skills.js`. Adding a file adds a skill; no code change is needed.

- A skill's body is handed only to the agents listed in `appliesTo` (`normalise`, `delta`, `requirements`, `testcases`, `scripts`, `execution`, `defects`, `report`). Skills written for the former `rules` agent load as `requirements`.
- After a phase runs, `src/handover.js` reads what it actually produced from the persisted cycle and checks it against every active skill's `delivers[phase]`. A missing or empty artefact makes the hand-over `incomplete`, and the phase card and cycle report show it. A comparison on a baseline cycle is reported as `n/a`, not as delivered.
- Skills are selected per run on the Run page, and all are on by default. The selected skills (text and hash) are stored on the cycle.
- The test case Excel column order comes from the report-targeted skill that declares one (`test-case-authoring.md`).
