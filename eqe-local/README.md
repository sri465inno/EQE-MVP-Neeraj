# EQE local: agentic quality engineering demo

## Run on your laptop
1. Install Node.js 22 LTS or newer (22.9+) from https://nodejs.org. Check with `node -v`.
2. Unzip, open the `eqe-local` folder and run the one-time setup (needs internet, downloads about 400 MB of packages and browsers):
   - Windows: double-click `setup.bat`
   - macOS/Linux: `./setup.sh`
3. Start everything:
   - Windows: double-click `start-all.bat` (four minimised "EQE - ..." windows open and the dashboard opens in your browser)
   - macOS/Linux: `./start-all.sh`
4. Open the EQE dashboard at http://localhost:4000. StayEase 1.0 is http://localhost:4100, StayEase 1.1 is http://localhost:4101 and mock Jira is http://localhost:4200.
5. Stop: `stop-all.bat` (Windows) or `./stop-all.sh` (macOS/Linux).

Mock Jira seeds itself from `apps/mock-jira/seed.js` on first start (initiatives MGPP-1 and MGPP-2). Cycles and reservations are written to `data/`, and logs to `logs/`. The rule-based engine works fully offline. The Devin (AI) engine needs a `.env` file (see "Devin engine" below).

Everything runs on this machine. There is no git remote and nothing is pushed or deployed.

| Service | Port | Folder |
|---|---|---|
| StayEase hotel booking app, release 1.0 (contains one known defect) | 4100 | `apps/stayease` |
| StayEase release 1.1 (defect fixed) | 4101 | same code, `STAYEASE_RELEASE=1.1` |
| Mock Jira (REST v3 subset + backlog UI; initiatives in project MGPP, epics and stories in EQE) | 4200 | `apps/mock-jira` |
| EQE dashboard (pipeline, agents, reports) | 4000 | `dashboard` |

Start: `npm install` (once), then `./start-all.sh`.

## Members (StayEase)
Reserving a room needs a signed-in member; Find reservation stays public. Demo members (also listed on the Sign in page):

| Level | Email | Password | Points per night |
|---|---|---|---|
| Gold | ava.thompson@example.com | gold2026 | 500 |
| Platinum | liam.carter@example.com | platinum2026 | 750 |
| Ambassador | priya.nair@example.com | ambassador2026 | 1,000 |

My account shows the level, points balance (confirmed reservations) and the member's reservations. Reset demo empties reservations, so accounts and points start from zero. Requirements: epic EQE-17 "Member login and loyalty" (EQE-18 to EQE-21) under MGPP-1.

## Pipeline (dashboard → New pipeline run)
1. **Requirements intake**: reads the initiative, epics, stories and acceptance criteria from Jira (`dashboard/src/agents/intake.js`).
2. **Requirements analysis**: testability, ambiguity, journey stage, risk and quality per AC (`analysis.js`, rules in `src/catalog.js`).
3. **E2E test design**: main guest journey plus negative/variant/manual cases and AC coverage (`design.js`).
4. **Lead review**: human approval gate; untick cases to exclude them (can be skipped per run).
5. **Script generation**: starts the Playwright MCP server (stdio), explores the live app black-box, resolves each step to an element in the accessibility snapshot, harvests the code MCP ran, and writes page objects plus one spec per test case (`scriptgen.js`, `src/mcp.js`).
6. **Execution**: runs the generated specs with `@playwright/test` (chromium, headless) and keeps screenshots and traces (`execution.js`).
7. **Reporting**: raises Jira bugs for failures, builds traceability AC → test case → script → result → defect and applies `dashboard/config/release-criteria.json` (`reporting.js`).

Each run is stored in `data/dashboard/runs/RUN-n/` (`run.json`, `automation/` with the Playwright project, `mcp/transcript.json`, `test-summary.md`).
The generated Playwright project can be re-run on its own:
`cd data/dashboard/runs/RUN-n/automation && npx playwright test --config playwright.config.ts`

## Demo story
- Run against release 1.0 (`http://localhost:4100`): TC-008 fails because Find reservation treats the last name as case-sensitive (EQE-8 AC3). A High bug is raised in mock Jira and the decision is **No-go**.
- Run against release 1.1 (`http://localhost:4101`): all automated cases pass and the decision is **Go**.
- Edit or add stories in mock Jira, then start a new run to see the analysis and tests change. "Reset to seed" restores the original backlog.

## Reset demo
Home, Run and Cycles pages have a **Reset demo** button (`POST /api/demo/reset`). It deletes all cycles, restores the seeded mock Jira backlog (raised bugs removed) and empties StayEase reservations for both releases. Tick "Run the two demo cycles again" to start release 1.0 (No-go) and 1.1 (Go) straight away. It refuses while a cycle is running.

## Watching the execution agent
Execution tab of a cycle: live frames from every headless browser while tests run (`support/fixtures.ts` writes them to `automation/live/`), a video recording and a Playwright trace per test afterwards ("Step-by-step" opens the trace viewer bundled in the local HTML report). "Slow-motion execution" on the Run page or "Run execution again" on the Execution tab replays a cycle at 350 ms per action with 2 workers.

## Devin engine (AI agents)

The Run page has an **Agent engine** choice:
- **Devin (AI):** one Devin session per cycle runs all six agents. The session starts StayEase on its own machine (or tests the stage URL you give), then reads the requirements, analyses, designs, automates, executes and reports. Both human gates stay in this dashboard; decisions are sent to the session as messages.
- **Rule-based (offline):** the original pattern catalogue on this machine.

To enable Devin, copy `.env.example` to `.env`, set `DEVIN_API_KEY` (service-user key, `cog_...`), `DEVIN_ORG_ID` and `DEVIN_API_URL`, then run `./start-all.sh`.

Further reading:
- `docs/DEVIN-INTEGRATION.md`: architecture, the organizational knowledge to store in Devin, every API call and payload, configuration and security.
- `dashboard/src/devin/`: the engine code.
- `dashboard/src/devin/kit/PROTOCOL.md`: the contract the session follows.
- `dashboard/test/fake-devin.js`: a stand-in Devin API for offline tests.
