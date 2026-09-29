---
id: test-case-authoring
name: Test case authoring and Zephyr export shape
description: One house style for every test case, so each cycle exports into Zephyr the same way.
appliesTo: [testcases, report]
delivers:
  testcases: [functional, nonFunctional]
  report: [testCaseExport]
---

Every test case carries a stable id: TC-F-### for functional, TC-N-### for non-functional. An id is never
re-used and never re-numbered between cycles; a case that changes keeps its id and gains a revision note.

Every case names the brId it verifies and the source issue or repository path behind that rule.

Write the case in these fields, in this order, because this is the order the Excel export uses and the order
Zephyr Scale expects: Key, Name, Objective, Precondition, Test Step, Test Data, Expected Result, Priority,
Type, Labels, Requirement link, Automation status, Cycle.

Name is a single sentence in the present tense describing the behaviour, not the action ("Restocking fee on an
electronics return is 20% of the price paid", not "Test the fee").

Objective states what business risk the case retires, in one sentence.

Steps are numbered, each a single action with a single observable outcome. No step says "verify everything".

Expected Result states an exact value or an exact condition — a number with its unit, a status, an error code.
Never "works as expected".

Labels always include the phases the case belongs to: functional or non-functional, plus regression once it is
in the standing pack, plus automation once a generated spec covers it. A case designed for an end-to-end,
performance or smoke run also carries e2e, performance or smoke.

Priority is High only when the rule it verifies is money, data loss, or a regulatory obligation.

A case with no expected value, no rule, or no observable outcome is not exported — it is reported as a gap.
