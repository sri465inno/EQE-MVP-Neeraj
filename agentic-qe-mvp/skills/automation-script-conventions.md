---
id: automation-script-conventions
name: Automation script conventions
description: How every generated Playwright spec is shaped, named and asserted, so scripts stay reviewable and runnable cycle after cycle.
appliesTo: [scripts]
delivers:
  scripts: [specs]
---

One spec file per business rule, named `br-###-<slug>.spec.js`. A case is never automated in two files.

Each spec opens with a comment block naming the business rule, its statement, and every test case id the file
covers. A reviewer must be able to read that block and know what is being proven without opening anything else.

Each `test()` title starts with the test case id: `TC-F-004 charges a 20% restocking fee on electronics`.

Specs are self-contained: no page objects, no shared helpers, no fixtures outside the file, so a spec can be
copied into another runner and still run.

Assert the exact value the test case states, with the unit in the title. Never assert "truthy", never assert a
range where the rule states a number.

Every assertion failure must print expected and actual — use the assertion that reports both rather than a
boolean check.

No `sleep`, no fixed waits; wait on the condition being asserted.

No test depends on another test's state or on execution order.

When a rule's value is superseded in a later cycle, the spec is regenerated with the new value and the old
value appears only in the comment block as the superseded one.
