# Agentic QE Platform - demo artifacts

Generated 2026-09-29T17:20:33.128Z by `node scripts/export-demo-artifacts.js`. Both cycles were run end to end; the Playwright results are real runs against the bundled sample service.

Inputs: Jira REST v3 exports (synthetic issues COM-1, COM-10/COM-11, COM-20) and the commission-engine codebase, pulled from GitHub branches `demo/jira-export`, `demo/commission-engine` and `demo/commission-engine-v2`. No live Jira call was made.

| Cycle | Flow | Requirements | Test cases | Scripts | Passed | Pass rate | Defects |
|---|---|---|---|---|---|---|---|
| CYC-1 | baseline | 14 | 15 | 13 | 13/14 | 92.9% | 1 |
| CYC-2 | incremental | 17 | 19 | 16 | 17/18 | 94.4% | 1 |

Each cycle folder's README is its QE lead report: inputs taken, how the cycle was run, artifacts produced, risks, a go/no-go recommendation and sign-off.

## Folder layout (per cycle)
- `01-inputs/` inputs with provenance, normalisation (agreed / single-source / conflicts) and, for Flow 2, the delta classification
- `02-requirements/` reviewed requirements repository
- `03-business-rules/` business rules with source quotes
- `04-test-cases/` test cases (JSON and Zephyr Scale Excel export)
- `05-automation-scripts/` generated Playwright specs
- `06-execution/` real Playwright JSON report, console output, mapped results and per-test evidence
- `07-defects/` defects raised from real failures only
- `08-report/` QE lead report (HTML, Markdown) and full cycle report (HTML, Excel, JSON)
- `09-merge-approval/` (Flow 2) merge proposal and approvals

`comparison/` holds the cycle 1 vs cycle 2 comparison (HTML, Excel, JSON).
Open the `.html` files in a browser (download them or clone the repo; GitHub shows HTML as source).
