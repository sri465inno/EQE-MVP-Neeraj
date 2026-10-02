# Demo inputs for Flow 1 and Flow 2

The same inputs the Run page pulls from GitHub, as files to read or share.
The API still accepts them as pasted text: send an input to `POST /api/cycles` as
`{ "mode": "paste", "text": "<file contents>" }`.

| Flow | Input | File |
|------|-------|------|
| Flow 1 - baseline | Jira initiative COM-1 | `flow-1-baseline/01-jira-initiative-COM-1.json` |
| Flow 1 - baseline | Jira epic COM-10 with story COM-11 | `flow-1-baseline/02-jira-epic-COM-10.json` |
| Flow 1 - baseline | Codebase `demo/commission-engine` (README + source) | `flow-1-baseline/03-codebase-commission-engine.md` |
| Flow 2 - incremental | Jira epic COM-20 with its stories | `flow-2-incremental/01-jira-epic-COM-20.json` |
| Flow 2 - incremental | Codebase `demo/commission-engine-v2` (README + source) | `flow-2-incremental/02-codebase-commission-engine-v2.md` |

- The Jira files are Jira Cloud REST API v3 responses (`GET /issue/{key}`; the epics as a
  `search/jql` result holding the epic and its child stories). The issues are synthetic.
- Pasted inputs are read into the same statements as the GitHub pull, so the review
  screen shows the same groups and the same GDS-uplift conflict.
- A pasted codebase carries no data dictionary, so the 1,000-attribute coverage section
  of the report is only filled when the codebase is pulled from GitHub.

Regenerate with `npm run demo:inputs`.
