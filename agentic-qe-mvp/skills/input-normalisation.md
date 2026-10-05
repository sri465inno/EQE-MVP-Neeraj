---
id: input-normalisation
name: Input normalisation and provenance
description: How several inputs become one requirement set, and what must be visible about where each statement came from.
appliesTo: [normalise, requirements]
delivers:
  normalise: [statements, gaps, conflicts]
  requirements: [businessRules]
---

Every statement kept after normalisation names every input that states it. A statement with no source is
dropped, never inferred.

Statements are labelled: corroborated (more than one input says it), single-source (only one does), or
conflicting (inputs state different values for the same subject).

A conflict is never resolved automatically. Both values are shown with their sources and left open for a human
to settle; downstream design waits for that decision.

Gaps are reported in both directions and named as such: present in Jira but absent from the code, and present
in the code but absent from Jira.

A statement about one subject never backs a rule about a different subject — a source naming only one product
category does not support a rule about another.

Quantities are read with their unit and never guessed; an issue key or a version number is not a quantity.

Provenance travels with the statement into the business rule: the rule quotes the sentence it came from and
names the issue key, repository path or document it was quoted from, and whether that input was a live call or
a recorded fixture.

The reviewed, normalised set — not the raw inputs — is what every later phase reads.
