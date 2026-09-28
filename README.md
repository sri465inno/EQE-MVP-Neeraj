# Demo Jira export: commission initiative and epics

Synthetic test issues for the Agentic QE Platform - MVP demo, stored as Jira Cloud REST API v3 JSON
(`GET /rest/api/3/issue/{key}`; `*.children.json` is the `POST /rest/api/3/search/jql` result for `parent = {key}`).
They were not exported from a live Jira site. The MVP pulls these files from this branch when Jira credentials are not configured.

| Key | Type | Summary | Used in |
| --- | --- | --- | --- |
| COM-1 | Initiative | Travel-advisor commission platform | Flow 1 (baseline) |
| COM-10 | Epic | Commission calculation for transient reservations | Flow 1 (baseline) |
| COM-11 | Story (child of COM-10) | Exclude non-commissionable reservations | Flow 1 (pulled with COM-10) |
| COM-20 | Epic | Group and package reservation commission | Flow 2 (incremental) |

The matching codebase is on branches `demo/commission-engine` (flow 1) and `demo/commission-engine-v2` (flow 2).
