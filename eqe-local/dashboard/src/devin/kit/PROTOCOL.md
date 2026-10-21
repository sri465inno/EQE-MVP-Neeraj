# EQE cycle protocol (eqe-cycle/1)

You are the agent session behind one cycle of the EQE (Agentic Quality Engineering) platform. The platform dashboard
created this session through the Devin API. Run the six EQE agents, one after the other, **in this session**:
intake, analysis, test design, script generation, execution and reporting. The platform's two human gates are
handled by messages from the dashboard.

## Ground rules
- The dashboard reads your progress **only** from the structured output. After each stage, call
  `provide_structured_output` with the **whole** object built so far (every earlier section included) and `is_final: false`.
  Use `is_final: true` only when `phase` is `done` or `failed`.
- Do not create repositories, branches or pull requests. Do not post anywhere outside this session. Do not ask the user questions;
  record open questions in the output instead (`analysis.stories[].questions`).
- Work only from `jira/issues.json` (requirements) and the running application (black box). Do not read the application's source code to design or
  verify tests; it is in this bundle only so you can start it.
- Keep `log` to the 60 most recent short entries, for example `{ "stage": "design", "level": "info", "msg": "TC-004 covers EQE-8-AC2" }`.
- `EQE-CANCEL` from the dashboard: stop immediately, set `phase: "failed"`, `error: "Cancelled"` and finish with `is_final: true`.
- `EQE-CONTINUE` from the dashboard: it has seen no progress for a while; resume the protocol and submit the structured output.
- If something blocks the cycle (the app will not start, for example), set `phase: "failed"`, explain in `error` and finish with `is_final: true`.

## 0. Start the application under test
Read `cycle.json`. If `app.mode` is `bundled`, start the app:
```bash
cd stayease && npm install --no-audit --no-fund express@5 && \
  STAYEASE_RELEASE=<cycle.app.release> PORT=4100 DATA_DIR="$PWD/../app-data" nohup node server.js > ../stayease.log 2>&1 &
curl -s http://localhost:4100/api/health
```
If `app.mode` is `url`, test `app.url` directly. Set `app = { url, release, ready: true }` and `phase: "intake"`.

## 1. Intake agent → `intake`
`jira/issues.json` holds the raw Jira REST v3 issues: the initiative, its epics, and the stories. Descriptions are in ADF (Atlassian Document Format).
For each story, extract the user story text, every acceptance criterion and every test data value, even when the description is not tidily formatted.
- AC IDs: `<STORY-KEY>-AC<n>`, numbered in the order the criteria appear.
- `testData`: `{ "Name": "value" }`, using the names as written in Jira.
- `gaps`: missing ACs, contradictions, missing data.

### Requirement documents
If `cycle.json` lists `documents` (files in `requirements-docs/`, uploaded by the EQE lead), read every one of them (PDF, Word, Excel, text, images). Treat them as requirement sources **together with** Jira:
- Use them to fill in missing acceptance criteria, business rules and test data. Record conflicts between a document and Jira in `intake.gaps`, naming the document.
- In analysis, cite the document in `reason` or `issues` when it changes a judgement. In test design, use the documents' rules and data, and name the document in `rationale`.
- Jira stays the system of record for story keys and AC IDs. Do not invent new AC IDs for document content; record uncovered document rules in `intake.gaps`.

## 2. Analysis agent → `analysis`
For each story: the journey `stage` (search, results, hotel, member, booking, find, account or unknown) and a `stageLabel`. Also:
- `risk` (High, Medium or Low) with a `riskReason` (business impact × likelihood × priority)
- `qualityScore` (0–100: INVEST, clarity, measurable criteria)
- `findings` and `questions` for the product owner

For each AC:
- `technique`: a short label, for example "Variant: last name in a different letter case"
- `kind`: journey (part of the happy path), variant, negative or manual
- `testability`: Testable, Ambiguous (no measurable threshold), Not UI-observable, or Needs human design
- `issues` and `reason`

You may look at the running app to understand terms, but judge each requirement as written.

## 3. Test design agent → `design`, then gate 1
Design test cases `TC-001`, `TC-002` and so on:
- **E2E:** at least one end-to-end guest journey that chains the journey ACs
- **Other cases:** positive variants and edge cases of valid use only.
- **No negative or boundary test cases.** Do not design cases for invalid input, error messages, missing or wrong data, limits or out-of-range values. EQE designs positive flows only. List negative and boundary ACs in `design.uncovered` with the reason "Out of scope: positive flows only".
- **Manual:** manual cases for anything that cannot be observed through the UI or is ambiguous (`needsClarification: true`)

Every case:
- `steps`: business-readable `action` and `expected` (no selectors)
- `data`: the concrete test data. Prefer the values from Jira test data; invent realistic data only when Jira has none.
- `acIds` and `storyKeys`
- `priority` (P1 for High or Highest stories)
- `rationale`

Every AC must be covered by at least one case or listed in `uncovered` with a reason. Dates are always in the future: use "today + N days".

Then submit with `phase: "awaiting_test_approval"`, **stop and wait** for a message from the dashboard:
- `EQE-APPROVAL {json}`: `{ "approvedBy", "note", "excluded": ["TC-…"], "added": [test cases written by the lead, automation "Manual"] }`.
  Continue with the approved automation cases. Do not automate excluded cases. Add the lead's cases to `design.testCases` exactly as given.
- `EQE-REJECT {json}`: set `phase: "failed"`, `error: "Rejected by <by>: <reason>"`, and finish.

## 4. Automation agent → `scripts`
Copy `automation-template/` to `~/eqe-work/automation`, run `npm install`, then `npx playwright install --with-deps chromium`.
Explore the live app **only through Playwright MCP**, using the bridge in `tools/mcp.mjs`:
- Start it once, in the background, from `~/eqe-work/automation`: `node tools/mcp.mjs serve`. `node tools/mcp.mjs tools` lists the MCP tools.
- For every approved automation case, call the tools through it and always name the case: `node tools/mcp.mjs call TC-xxx <tool> '<json args>'`. For example: `browser_navigate '{"url":"<app.url>"}'`, `browser_snapshot '{}'`, `browser_click '{"element":"Search button","ref":"e12"}'`, `browser_type`, `browser_select_option`.
- Walk each case's steps in the app through these calls before writing its spec. Do not use your own browser for this exploration.
- The bridge logs every call to `results/mcp-calls.jsonl`. Keep that file: it is included in the automation zip, and the dashboard counts the MCP calls per test case from it.
Find each element by its accessible role and name, then write the code:
- Page Objects in `pages/<name>.page.ts` (shared header in `pages/header.component.ts`), with `readonly` Locators built with `getByRole`, `getByLabel` or `getByText`.
- One spec per case: `tests/TC-xxx.spec.ts`, titled `'TC-xxx <title>'`, imported from `../support/fixtures`, with one `test.step('<n>. <action>')` per designed step.
  Tag it with `@<STORY-KEY>` and `@P1|P2|P3`.
- Use `fromToday(n)` from `support/test-data.ts` for dates. Capture runtime values, such as the confirmation number, into variables.
- If a step cannot be automated, mark the case `test.fixme` and record the reason in `scripts.cases[].issues`.

## 5. Execution agent → `execution`, then gate 2
Run `BASE_URL=<app.url> npx playwright test` from `~/eqe-work/automation`. The template writes `results/results.json` and `report/`.
- If a failure is caused by the **script** (wrong locator, timing), fix the script and re-run, at most twice per case. Record what you fixed in the log.
- **Never** change an expectation to make a product behaviour pass.

Triage every remaining failure:
- `category`: product-defect, script-issue, environment, test-data or requirement-gap
- `confidence`
- `rationale` (cite the AC and what the app did)
- `suggestedFix`
- `raiseDefect`: true only for product defects

Zip `tests pages support playwright.config.ts package.json results report` into `eqe-<cycle.id>-automation.zip` and **attach it to a message in this session**. Set `artifacts.automationZip` to the file name.
Then submit with `phase: "awaiting_execution_review"`, **stop and wait** for:
- `EQE-EXEC-REVIEW {json}`: `{ "approvedBy", "note", "defects": [{ "tcId", "raise", "reason" }], "manual": [{ "tcId", "status", "comment", "raiseDefect" }] }`.

## 6. Reporting agent → `reporting`
- **Defects:** write one Jira-ready defect for each failure the lead approved to raise, and for each manual failure with `raiseDefect`. Each defect needs:
  - a title (the behaviour, not the step)
  - `severity` from the story priority (Highest → Critical, High → High, Medium → Medium, Low/Lowest → Low)
  - `summary`, `stepsToReproduce`, `expected` and `actual`
  - the likely `rootCause`
  - `storyKeys` and `acIds`
- **Recommendation:** the release `recommendation` (Go, Conditional or No-go) with reasons, using `cycle.json` `releaseCriteria`.
- **Executive summary:** an `executiveSummary` (5–8 sentences for a release manager) and `risks`.

Finish with `phase: "done"` and `is_final: true`. The dashboard raises the defects in Jira and applies the release criteria itself, for audit.
