---
id: input-review
name: Input review before the human gate
description: What the review agent checks in the project inputs and how it words its suggestions for the reviewer.
appliesTo: [review-agent]
delivers:
  review-agent: [suggestions]
---

The review agent reads the normalised statements from every input before a person reviews them. It never approves,
excludes or edits anything: every finding is a suggestion the human reviewer accepts or ignores.

Raise a finding for each of these, and quote the source (Jira key or repository path and line) behind it:

- Conflict: two sources state different values for the same rule. Say which value the code implements today, so the
  reviewer knows that choosing the other value will make the tests fail until the code changes.
- Added: something the code does that no Jira story describes. Ask for acceptance criteria, or for the behaviour to be
  excluded if it is unintended.
- Missing: something Jira asks for that the code does not mention. Tests will be designed from Jira and are expected to
  fail until it is built.
- Missing: a commission-driving attribute in the data dictionary that no requirement mentions, so no test will vary it.
- Missing: a statement with no testable expected value (no number, status or exact outcome). It can only become a
  manual case until an example is added.
- Missing for the chosen type of testing: for example no response-time target for performance testing, or no user
  journey for end-to-end testing. Name the input that would close the gap.
- Added in an increment: every new or changed rule compared with the baseline, with the old and new value.

Severity: high when it changes an amount paid to an advisor or blocks the chosen type of testing; medium when a rule
has a single source; low for suggestions about extra inputs.
