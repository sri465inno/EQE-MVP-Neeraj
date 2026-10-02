# Demo inputs for Flow 1 and Flow 2

The same inputs the Run page pulls from GitHub, as files to read or share.
The API still accepts them as pasted text: send an input to `POST /api/cycles` as
`{ "mode": "paste", "text": "<file contents>" }`.

| Flow | Input | File |
|------|-------|------|
| Flow 1 - hotel booking baseline | Jira initiative AQPI-1 | `flow-1-hotel-booking/01-jira-initiative-AQPI-1.json` |
| Flow 1 - hotel booking baseline | Jira epics AQPI-2, 6, 10, 14, 18, 23, 27 with their 23 stories | `flow-1-hotel-booking/02-jira-epics-AQPI-2-to-AQPI-27.json` |
| Flow 1 - hotel booking baseline | Codebase `demo/hotel-booking-platform` (README, traceability, POMs, Java source, config) | `flow-1-hotel-booking/03-codebase-hotel-booking-platform.md` |
| Flow 1 - commission baseline (needed before Flow 2) | Jira initiative COM-1 | `flow-1-baseline/01-jira-initiative-COM-1.json` |
| Flow 1 - commission baseline | Jira epic COM-10 with story COM-11 | `flow-1-baseline/02-jira-epic-COM-10.json` |
| Flow 1 - commission baseline | Codebase `demo/commission-engine` (README + source) | `flow-1-baseline/03-codebase-commission-engine.md` |
| Flow 2 - incremental | Jira epic COM-20 with its stories | `flow-2-incremental/01-jira-epic-COM-20.json` |
| Flow 2 - incremental | Codebase `demo/commission-engine-v2` (README + source) | `flow-2-incremental/02-codebase-commission-engine-v2.md` |

- The Jira files are Jira Cloud REST API v3 responses (`GET /issue/{key}`; the epics as a
  `search/jql` result holding the epic and its child stories). The COM issues are synthetic; the AQPI
  issues are exported from the AQPI Jira space.
- When pasting the hotel codebase, also send `"branch": "demo/hotel-booking-platform"` so the cycle runs
  against the hotel services (the Run page does this for you).
- Pasted inputs are read into the same statements as the GitHub pull, so the review
  screen shows the same groups and the same GDS-uplift conflict.
- A pasted codebase carries no data dictionary, so the 1,000-attribute coverage section
  of the report is only filled when the codebase is pulled from GitHub.

Regenerate with `npm run demo:inputs`.
