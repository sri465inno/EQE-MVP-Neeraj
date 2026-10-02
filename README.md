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

## Hotel booking initiative (AQPI)

`AQPI-1` (initiative), the seven epics `AQPI-2`, `AQPI-6`, `AQPI-10`, `AQPI-14`, `AQPI-18`, `AQPI-23`, `AQPI-27`
(each with `*.children.json` listing its stories) and the 23 stories `AQPI-3` … `AQPI-31`, exported from the
AQPI Jira space (https://tcs-team-ou6drgfr.atlassian.net/jira/core/projects/AQPI). In that space the initiative and
epics are Workstreams and the stories are Tasks; the labels `initiative`, `epic` and `user-story` carry the role.

## `jira/release-2.0/`

Snapshot of the release 2.0 scope for Flow 2: Epic 8 AQPI-32 (AQPI-33 to AQPI-36) and Epic 6 AQPI-23 as revised for release 2.0 (AQPI-24 and AQPI-25 changed, AQPI-26 unchanged, new AQPI-37). The top-level `jira/AQPI-23*.json` files keep the release 1.0 Epic 6 that Flow 1 uses.
