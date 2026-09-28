---
id: cycle-report
name: Test cycle report
description: The fixed shape of every cycle report, so two cycles can be read side by side without translation.
appliesTo: [report]
delivers:
  report: [cycleReport, comparison]
---

Every cycle report has these sections, in this order, whether or not any of them is empty:

1. Cycle header — cycle number, baseline it builds on, who ran it, start and end time.
2. Inputs — every input with its type, origin (Jira issue key, repository and branch, file), and whether it was
   a live call or a recorded fixture. Never leave provenance implicit.
3. Requirements — counts by status (carried over, enhanced, new), and the list of enhanced ones with the old
   value beside the new one.
4. Test cases — counts by type and phase label, plus added / changed / carried over for this cycle.
5. Automation — specs generated, specs changed, cases covered, cases not automated and why.
6. Execution — executed, passed, failed, quarantined, pass rate, duration, and the runner that produced it.
   State explicitly that these numbers come from an actual run.
7. Defects — every defect with severity and blocking status, new this cycle marked as such.
8. Coverage — rules with at least one case, rules without, and the gaps by name.
9. Approvals — who approved what, when, and what they changed at the gate.
10. What this cycle reused — artefacts carried over without being re-designed, as a count and a percentage,
    with the sentence that reuse means they were not re-designed, not that they were not executed.

Every number in the report is computed from stored artefacts, never restated from an earlier report and never
estimated. A number that cannot be computed is shown as "not measured", not as zero.

The comparison between two cycles uses the same section order, showing each line as previous → current with the
delta, and lists added, changed and removed artefacts by id.
