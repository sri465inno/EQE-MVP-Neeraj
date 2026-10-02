# Demo inputs for Flow 1 and Flow 2

The same inputs the Run page pulls from GitHub, as files to read or share.
The API still accepts them as pasted text: send an input to `POST /api/cycles` as
`{ "mode": "paste", "text": "<file contents>" }`.

| Flow | Input | File |
|------|-------|------|
| Flow 1 - hotel booking baseline | Jira initiative AQPI-1 | `flow-1-hotel-booking/01-jira-initiative-AQPI-1.json` |
| Flow 1 - hotel booking baseline | Jira epics AQPI-2, 6, 10, 14, 18, 23, 27 with their 23 stories | `flow-1-hotel-booking/02-jira-epics-AQPI-2-to-AQPI-27.json` |
| Flow 1 - hotel booking baseline | Codebase `demo/hotel-booking-platform` (README, traceability, POMs, Java source, config) | `flow-1-hotel-booking/03-codebase-hotel-booking-platform.md` |
| Flow 2 - hotel booking release 2.0 (incremental) | Jira epic AQPI-32 "Release 2.0" with stories AQPI-33 to AQPI-36 | `flow-2-hotel-release-2/01-jira-epic-AQPI-32.json` |
| Flow 2 - hotel booking release 2.0 (incremental) | Codebase `demo/hotel-booking-platform-v2` (README, traceability, POMs, Java source, config) | `flow-2-hotel-release-2/02-codebase-hotel-booking-platform-v2.md` |

- The Jira files are Jira Cloud REST API v3 responses (`GET /issue/{key}`; the epics as a
  `search/jql` result holding the epic and its child stories). The AQPI issues are exported from the
  AQPI Jira space.
- When pasting a hotel codebase, also send its branch (`"branch": "demo/hotel-booking-platform"` for Flow 1,
  `"branch": "demo/hotel-booking-platform-v2"` for Flow 2) so the cycle runs against the hotel services of that
  release (the Run page does this for you).
- Flow 2 adds release 2.0 on top of a Flow 1 baseline, so run Flow 1 first.
- Pasted inputs are read into the same statements as the GitHub pull, so the review
  screen shows the same groups.
- A pasted codebase carries no data dictionary, so the attribute coverage section
  of the report is only filled when the codebase is pulled from GitHub.

Regenerate with `npm run demo:inputs`.
