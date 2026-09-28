# Agentic QE Platform - MVP

A standalone MVP that takes Jira scope plus a codebase and produces reviewed requirements, business rules, test cases (Excel, Zephyr Scale columns), Playwright scripts, **real** execution results against a bundled sample service, defects from real failures, and cycle reports. It proves two flows:

1. **Baseline cycle** - Jira initiative + Jira epic + codebase -> deterministic 3-way normalisation (Jira-only / code-only / conflicts) -> human review -> requirements -> rules -> test cases -> scripts -> execution -> defects -> report.
2. **Incremental cycle** - pick an approved baseline, add one new Jira epic + the updated codebase branch -> delta (unchanged / enhanced / new) -> only enhanced + new are designed -> human merge approval -> re-execution -> Cycle 2 report + cycle comparison.

## Run

```bash
npm install
npx playwright install chromium   # headless browser for the UI specs
npm start                         # http://localhost:3000  (PORT, DATA_DIR env vars optional)
npm test                          # acceptance tests (node --test)
npm run lint                      # node --check on every JS file
```

Node 20+.

## What is real and what is recorded

| Thing | Status |
| --- | --- |
| Jira initiative / epics | Recorded Jira REST API v3 issue JSON in `fixtures/jira`. Live calls happen only when `JIRA_BASE_URL`, `JIRA_EMAIL` and `JIRA_API_TOKEN` are all set; the UI labels every input as `recorded fixture`, `live call` or `pasted`. |
| Codebase | Recorded GitHub REST API shapes (repo, branch, contents, compare) in `fixtures/github/<branch>`. No live GitHub connector yet. |
| Normalisation, delta, coverage, pass/fail, defects | Computed in code (`src/normalise.js`, `src/delta.js`, `src/coverage.js`, `src/execution.js`, `src/defects.js`) and covered by tests. |
| Execution | Real: generated specs are written to `data/runs/<cycle>/` and run by the Playwright CLI (headless) against the bundled service in `sut/`; the JSON report is parsed. |
| Seeded defect | `sut/app.js` truncates refunds instead of rounding (`toMoney`), so the rounding test case genuinely fails. |
| Prose | Without `ANTHROPIC_API_KEY` a deterministic template drafts the report narrative (demo mode). With a key the model drafts only that narrative. |

## Layout

- `src/connectors` - Jira (live or fixture) and GitHub-shaped codebase fixtures
- `src/extract.js`, `src/text.js` - statement extraction and value parsing
- `src/normalise.js`, `src/delta.js` - deterministic comparison engines
- `src/agents` - requirements, business rules, test design and Playwright script generation
- `src/execution.js`, `src/defects.js`, `src/coverage.js` - real execution and its consequences
- `src/pipeline.js` - fixed-order cycle orchestration with review and merge gates
- `src/report.js`, `src/compare.js`, `src/excel.js` - report, comparison, xlsx exports
- `src/store.js` - JSON persistence under `data/` (survives restarts)
- `public/` - plain HTML/CSS/JS UI; `sut/` - the system under test; `test/` - acceptance tests
