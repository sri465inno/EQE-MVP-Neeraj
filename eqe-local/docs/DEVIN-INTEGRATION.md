# EQE Agentic QE platform on Devin: knowledge and API contract

This document describes how the EQE dashboard uses the Devin API so that **one Devin session per cycle** runs all six agents:
intake, analysis, test design, script generation, execution and reporting. It covers three things:

1. What should be stored in Devin as **organizational knowledge**. This is stable guidance that every cycle session reuses.
2. What the platform **sends in each API call**. This is per-cycle data.
3. Configuration, permissions and security.

The source of truth for the session's behaviour is the protocol file `dashboard/src/devin/kit/PROTOCOL.md` (protocol `eqe-cycle/1`).
It is shipped inside every cycle bundle. The structured output schema is in `dashboard/src/devin/schema.js`. The knowledge entries below repeat
the stable parts of the protocol, so the knowledge and the protocol must change together. When either changes, bump the protocol version.

---

## 1. Architecture

| Step | Dashboard (this machine) | Devin session |
|---|---|---|
| Start | Reads the initiative, epics and stories from Jira (raw REST v3 JSON). Builds the cycle bundle and uploads it. Creates the session. | Unzips the bundle, reads `PROTOCOL.md`, then starts the app: bundled StayEase for the demo, or the stage URL in production. |
| 1 Intake | Shows the stories and ACs extracted by Devin, plus the gaps it found. | Extracts the user story, ACs (`<KEY>-AC<n>`) and test data from the ADF descriptions. |
| 2 Analysis | Shows testability, risk with reasons, quality and PO questions. | Judges every AC and every story. |
| 3 Design | Shows the test cases and traceability. | Designs E2E, positive variant and manual cases (no negative or boundary cases). Then stops at `awaiting_test_approval`. |
| Gate 1 | The lead approves, excludes or adds cases, or rejects. Sends `EQE-APPROVAL` or `EQE-REJECT`. | Waits for the message. |
| 4 Scripts | Shows the specs and page objects. | Explores the live app with a browser and writes Page Objects and one Playwright spec per approved case. |
| 5 Execution | Downloads the automation zip (specs, results, HTML report, videos, traces) and shows the results with Devin's triage. | Runs Playwright, repairs script-only failures (at most 2 retries) and triages each failure. Attaches the zip, then stops at `awaiting_execution_review`. |
| Gate 2 | The lead decides which failures become defects and records manual results. Sends `EQE-EXEC-REVIEW`. | Waits for the message. |
| 6 Reporting | Raises Jira bugs using Devin's wording and applies `release-criteria.json` (Go / Conditional / No-go). Shows Devin's executive summary and recommendation. | Writes the defects, the executive summary, a recommendation and the risks. Finishes with `phase: done`. |

The Go/No-go decision stays a deterministic rule in the dashboard, so it can be audited. Devin's recommendation is shown next to it.

---

## 2. Organizational knowledge to store in Devin

Store these as organization knowledge notes in Devin (Settings > Knowledge). They are reused by every EQE cycle session.
After saving them, put their IDs in `DEVIN_KNOWLEDGE_IDS` so the dashboard attaches them to each session explicitly (`knowledge_ids`).

### K1. EQE cycle protocol: overview
- **Trigger:** "EQE cycle", "eqe-cycle/1", "EQE platform's agent session", "PROTOCOL.md"
- **Content:**
  - An EQE cycle session is created by the EQE dashboard through the API. It runs six agents in order: intake, analysis, test design, script generation, execution and reporting.
  - The attached bundle `eqe-<RUN>-bundle.zip` contains `PROTOCOL.md` (the contract), `cycle.json` (cycle settings and release criteria), `jira/issues.json` (raw Jira issues in ADF), `automation-template/` (Playwright project) and, for the demo only, `stayease/`.
  - Always read `PROTOCOL.md` first. If it disagrees with knowledge, `PROTOCOL.md` wins.
  - Report progress only through `provide_structured_output`. Submit the whole object after every stage, with `is_final=false` until `phase` is `done` or `failed`.
  - Do not open repositories or pull requests, do not post outside the session, and do not ask questions in chat. Put open questions into `analysis.stories[].questions`.
  - Treat the application as a black box: design and verify from the requirements and the running app, never from the app's source code.

### K2. EQE structured output contract
- **Trigger:** "EQE structured output", "eqe-cycle/1 output"
- **Content:**
  - `protocol` is always `"eqe-cycle/1"`.
  - `phase` takes these values in order: `starting`, `intake`, `analysis`, `design`, `awaiting_test_approval`, `scripts`, `execution`, `awaiting_execution_review`, `reporting`, `done`. It is set to `failed`, with an `error`, when the cycle is blocked.
  - Sections:
    - `app` `{url, release, ready}`
    - `log[]` `{stage, level, msg}`: at most 60 short entries.
    - `intake` `{summary, stories[{key, summary, epicKey, priority, text, ac[{id, text}], testData{}}], gaps[{storyKey, text}]}`
    - `analysis` `{summary, stories[{key, stage, stageLabel, risk, riskReason, qualityScore, findings[{level, text}], questions[], acs[{id, technique, kind, testability, issues[], reason}]}]}`
      - `stage`: search, results, hotel, member, booking, find, account or unknown
      - `kind`: journey, variant, negative or manual
      - `testability`: Testable, Ambiguous, Not UI-observable or Needs human design
    - `design` `{summary, testCases[{id "TC-001", title, type, automation, priority, acIds, storyKeys, preconditions, data{}, steps[{n, action, expected}], rationale, needsClarification}], uncovered[{acId, reason}]}`
      - `automation`: Automation or Manual
      - `priority`: P1, P2 or P3
    - `scripts` `{summary, cases[{tcId, file, status, issues[], steps[]}], pageObjects[{class, file, locators[{prop, locator}]}]}`
      - `status`: generated or needs-attention
    - `execution` `{summary, passed, failed, skipped, durationMs, results[{tcId, status, durationMs, failedStep, error, triage{category, confidence, rationale, suggestedFix, raiseDefect}}]}`
    - `reporting` `{executiveSummary, recommendation{decision, reasons[]}, defects[{tcId, title, severity, summary, stepsToReproduce[], expected, actual, rootCause, storyKeys, acIds}], risks[]}`
    - `artifacts` `{automationZip}`

### K3. EQE gate messages
- **Trigger:** "EQE-APPROVAL", "EQE-REJECT", "EQE-EXEC-REVIEW", "EQE-CONTINUE", "EQE-CANCEL"
- **Content:** these messages come from the EQE dashboard, on behalf of the named EQE lead. The JSON follows the keyword on the same line.
  - `EQE-APPROVAL {"approvedBy", "note", "excluded":["TC-…"], "added":[test cases written by the lead]}`: automate only the approved automation cases, and add the lead's cases to `design.testCases` unchanged.
  - `EQE-REJECT {"rejectedBy", "reason"}`: finish with `phase: failed`.
  - `EQE-EXEC-REVIEW {"approvedBy", "note", "defects":[{"tcId", "raise", "reason"}], "manual":[{"tcId", "status", "comment", "raiseDefect"}]}`: write defects only for `raise: true`, and for manual failures with `raiseDefect`.
  - `EQE-CONTINUE`: the dashboard has seen no progress; resume the protocol and submit the output.
  - `EQE-CANCEL`: stop now and finish with `phase: failed` and `error: "Cancelled"`.

### K4. EQE test design standards
- **Trigger:** "EQE test design", "design test cases for the EQE cycle"
- **Content:**
  - Test cases are numbered `TC-001` upwards. Design at least one end-to-end journey that chains the journey ACs, then positive variants and edge cases of valid use. Never design negative or boundary test cases; list those ACs as out of scope.
  - Steps are business-readable `action` and `expected` (no selectors). Every case links `acIds` and `storyKeys`, and every AC is covered or listed in `uncovered` with a reason.
  - Priority is P1 for High or Highest stories, P2 for Medium, and P3 for the rest.
  - Prefer test data from the Jira "Test data" section; invent realistic data only when it is missing. Dates are always in the future ("today + N days").
  - Use manual cases for criteria that cannot be observed through the UI (emails, back-office) and for ambiguous criteria (`needsClarification: true`).

### K5. EQE Playwright automation conventions
- **Trigger:** "EQE automation", "EQE Playwright", "automation-template"
- **Content:**
  - **Project setup:** copy `automation-template/` to `~/eqe-work/automation`, then run `npm install` and `npx playwright install --with-deps chromium`. `@playwright/test` is pinned (1.63.0) so the scripts also run on the dashboard machine.
  - **Page Objects:** `pages/<name>.page.ts`, plus `pages/header.component.ts` for the shared header. Use `readonly` Locators built with `getByRole`, `getByLabel` or `getByText`. Avoid CSS/XPath unless there is no accessible alternative.
  - **Specs:** one spec per case, `tests/TC-xxx.spec.ts`, titled `'TC-xxx <title>'`. Import `test` and `expect` from `../support/fixtures`. Use one `test.step('<n>. <action>')` per designed step, and tag with `@<STORY-KEY>` and `@P1|P2|P3`.
  - **Data:** use `fromToday(n)` for dates and capture runtime values (such as the confirmation number) into variables. Mark a case `test.fixme` and record the reason if it cannot be automated.
  - **Running:** `BASE_URL=<app url> npx playwright test`. The template writes `results/results.json` (JSON reporter), `report/` (HTML), and a video and trace for every test.
  - **Deliverable:** zip `tests pages support playwright.config.ts package.json results report` as `eqe-<RUN>-automation.zip` and attach it to a session message. Put the file name in `artifacts.automationZip`.

### K6. EQE failure triage and defect standards
- **Trigger:** "EQE triage", "EQE defect"
- **Content:**
  - **Script failures:** fix script-caused failures (wrong locator, timing), at most twice per case. Never change an expectation to make a product behaviour pass.
  - **Triage categories:** `product-defect`, `script-issue`, `environment`, `test-data` or `requirement-gap`. Each triage gives a confidence, a rationale that cites the AC and what the app did, and a suggested fix. `raiseDefect` is true only for product defects.
  - **Severity:** follows the story priority: Highest → Critical, High → High, Medium → Medium, Low/Lowest → Low.
  - **Defects:** the title describes the behaviour, not the failing step. Each defect has a summary, numbered steps to reproduce, expected, actual and the likely root cause.
  - **Recommendation:** follows `cycle.json` `releaseCriteria`: No-go on Critical defects or a pass rate below the minimum; Conditional on High defects or low AC coverage. The dashboard applies the binding rule.

### K7. Applications under test
- **Trigger:** "StayEase", "EQE application under test", "stage URL"
- **Content:**
  - **Demo:** StayEase (hotel booking) is shipped in the bundle. Start it with `cd stayease && npm install express@5 && STAYEASE_RELEASE=<1.0|1.1> PORT=4100 DATA_DIR=../app-data node server.js`. Health check: `GET /api/health`.
  - **Production:** `cycle.json` has `app.mode: "url"` and a stage URL. Test that URL directly; credentials, when needed, arrive as session secrets. Never test production URLs.

### What must not go into knowledge
- **Per-cycle data:** Jira issues, release, reviewer, gate decisions and run IDs. These are sent in each API call.
- **Secrets:** API keys and application credentials. Use Devin secrets or `session_secrets`.
- **Expected results or known defects of an application:** the session must find defects black-box. For example, StayEase 1.0's Find reservation defect must not be mentioned.

---

## 3. What the platform sends in each API call

All calls go to `{DEVIN_API_URL}/v3/organizations/{DEVIN_ORG_ID}` with `Authorization: Bearer {DEVIN_API_KEY}`.
For this tenant, use `DEVIN_API_URL=https://tcs-marriott-pilot.devinenterprise.com/api`. `https://api.devin.ai` also answers for this key.

| # | When | Call | Body / what is sent | Code |
|---|---|---|---|---|
| 1 | Cycle start | `POST /attachments` (multipart `file`) | `eqe-<RUN>-bundle.zip`: `PROTOCOL.md`, `cycle.json`, `jira/issues.json`, `automation-template/`, `stayease/` (demo only) | `brief.js` `buildBundle()` |
| 2 | Cycle start | `POST /sessions` | `prompt`, `title`, `tags`, `attachment_urls`, `structured_output_schema`, `structured_output_required: false`, optional `max_acu_limit`, `knowledge_ids` and `playbook_id` | `engine.js` `start()` |
| 3 | Every 15 s | `GET /sessions/{devin_id}` | Nothing sent. Reads `status`, `status_detail`, `acus_consumed` and `structured_output` | `engine.js` `waitFor()` |
| 4 | Gate 1 | `POST /sessions/{devin_id}/messages` | `EQE-APPROVAL {...}` or `EQE-REJECT {...}` | `engine.js` `scripts()` |
| 5 | Gate 2 | `POST /sessions/{devin_id}/messages` | `EQE-EXEC-REVIEW {...}` | `engine.js` `reporting()` |
| 6 | Idle or cancel | `POST /sessions/{devin_id}/messages` | `EQE-CONTINUE: …` (after 12 min without progress) or `EQE-CANCEL: …` | `engine.js` `waitFor()`, `pipeline.js` `cancel()` |
| 7 | After execution | `GET /sessions/{devin_id}/attachments`, then `GET /attachments/{attachment_id}/{name}`, which answers 307 with a presigned storage URL | Nothing sent. Fetches `eqe-<RUN>-automation.zip` | `engine.js` `fetchAutomation()`, `client.js` `downloadAttachment()` |

`structured_output_required` is false on purpose. When it is true, the session must submit a *final* output before every turn ends, and that would end the cycle at the first human gate.

### 3.1 `cycle.json` (inside the bundle)
```json
{
  "protocol": "eqe-cycle/1", "id": "RUN-1", "initiative": "MGPP-1", "reviewer": "Jefrin J",
  "app": { "mode": "bundled", "name": "StayEase", "release": "1.0", "url": "http://localhost:4100" },
  "releaseCriteria": { "minAutomationPassRate": 95, "minAcceptanceCriteriaCoverage": 80, "noGoSeverities": ["Critical"], "conditionalSeverities": ["High"], "signOffOwner": "EQE lead" },
  "options": { "autoApprove": false }
}
```
In production, `app` becomes `{ "mode": "url", "url": "https://stage.example.com", "release": "…" }`. Set it with the "Stage URL" field on the Run page.

### 3.2 `jira/issues.json` (inside the bundle)
```json
{ "source": "http://localhost:4200",
  "initiative": { "key": "MGPP-1", "issuetype": "Initiative", "summary": "…", "priority": "High", "status": "…", "labels": [], "parent": null, "description": { "type": "doc", "content": [] } },
  "epics":   [ { "key": "EQE-2", "issuetype": "Epic", "parent": "MGPP-1", "description": {} } ],
  "stories": [ { "key": "EQE-5", "issuetype": "Story", "parent": "EQE-2", "priority": "High", "description": {} } ] }
```

### 3.3 Session prompt (example for RUN-1)
```
EQE cycle RUN-1: you are the Agentic Quality Engineering platform's agent session for Jira initiative MGPP-1, testing the bundled StayEase 1.0 demo app (start it inside this session).

1. Unzip the attached eqe-RUN-1-bundle.zip into ~/eqe-work and read ~/eqe-work/PROTOCOL.md completely. It is the contract with the EQE dashboard (protocol eqe-cycle/1).
2. Run the six agents in order (intake, analysis, test design, script generation, execution, reporting) exactly as PROTOCOL.md says.
3. Report progress only through provide_structured_output, submitting the whole object after every stage (is_final=false until phase is done or failed).
4. Stop at phase awaiting_test_approval and at phase awaiting_execution_review, and wait for the dashboard's EQE-APPROVAL / EQE-EXEC-REVIEW messages. Jefrin J is the EQE lead.
5. Do not open repositories or pull requests, and do not ask questions in chat. Record open questions in the output.
```

### 3.4 Gate messages (examples)
```
EQE-APPROVAL {"approvedBy":"Jefrin J","note":"Scope agreed for release 1.0","excluded":["TC-007"],"added":[]}
EQE-EXEC-REVIEW {"approvedBy":"Jefrin J","note":"Reviewed","defects":[{"tcId":"TC-008","raise":true,"reason":""}],"manual":[{"tcId":"TC-012","status":"passed","comment":"","raiseDefect":false}]}
```

Each cycle writes an audit trail to `data/dashboard/runs/<RUN>/devin/`:
- the bundle
- `jira-issues.json`
- `create-session.json` (the request body without the schema)
- the latest `structured-output.json`
- the downloaded automation zip

Every message sent is listed in `run.json` under `devin.messages`.

---

## 4. Configuration

Copy `.env.example` to `.env` in the eqe-local folder and restart with `./start-all.sh` (the dashboard loads `.env` itself).

| Variable | Required | Meaning |
|---|---|---|
| `DEVIN_API_KEY` | yes | Service-user API key (`cog_…`). This is the key, not the service-user ID. |
| `DEVIN_ORG_ID` | yes | `org-…` from Settings > Devin API |
| `DEVIN_API_URL` | yes for this tenant | `https://tcs-marriott-pilot.devinenterprise.com/api` |
| `DEVIN_KNOWLEDGE_IDS` | recommended | Comma-separated IDs of the K1–K7 knowledge notes |
| `DEVIN_MAX_ACU` | optional | ACU cap per cycle session |
| `DEVIN_PLAYBOOK_ID` | optional | A playbook to attach (for example a future "EQE cycle" playbook holding the protocol) |
| `DEVIN_POLL_SECONDS` / `DEVIN_STAGE_TIMEOUT_MINUTES` / `DEVIN_NUDGE_MINUTES` | optional | Poll interval (15 s), per-stage timeout (90 min) and idle nudge (12 min) |

**Service-user role permissions:**
- `UseDevinSessions`: create sessions, send messages, upload attachments and read the sessions it created.
- `ViewOrgSessions`: optional.
- Knowledge management: only if the platform should manage knowledge notes itself (it does not today).

**Outbound network access from the dashboard machine:**
- `tcs-marriott-pilot.devinenterprise.com` (API, HTTPS)
- `devin-public-attachments.s3.dualstack.us-west-2.amazonaws.com` (presigned attachment downloads)

The `url` field in an attachment listing points to the webapp, which needs a browser login. The dashboard therefore downloads through the API endpoint instead.

## 5. Security and data flow
- **Data sent to Devin:** the Jira initiative, epics and stories, and (demo) the StayEase app are uploaded to Devin. In production the session reaches the stage URL directly. Requirements text leaves the machine, so the Jira project must be approved for Devin.
- **API key:** read only from the environment and never written to logs or run files. `create-session.json` contains no credentials.
- **Human gates:** both gates remain mandatory. The session never raises Jira bugs or makes the release decision itself.
- **Offline mode:** the rule-based engine still works with no network, as a demo fallback ("Agent engine" on the Run page).

## 6. Moving from the demo to production
- **Real Jira:** point `JIRA_URL` at it (auth must be added to `dashboard/src/jira.js`). Alternatively, let the session read Jira through Devin's Atlassian integration and drop `jira/issues.json`.
- **Stage URLs:** give a stage URL per cycle. The session must be able to reach it (public stage, or private network access for Devin).
- **Application credentials:** store them as Devin secrets and pass their IDs in `secret_ids`, or pass them per cycle in `session_secrets` (both are create-session fields).
