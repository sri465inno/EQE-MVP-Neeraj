---
id: test-data-generation
name: Test data generation from the input specs
description: Every test case gets a complete, spec-conformant data set built from the data dictionary in the codebase input.
appliesTo: [testdata]
delivers:
  testdata: [dataSets, specConformance]
---

The data dictionary that arrives with the codebase input is the specification for test data. Build one data
set per test case, keyed by the case (TC-F-001 -> TD-F-001), carrying every attribute the dictionary defines.

The values a case varies (its drivers) come from the case's Test Data line and nothing else. Every
other attribute is generated to the dictionary: an enum takes one of its allowed values, the rest take the
dictionary example. The same case always gets the same data, so a re-run reproduces the result.

Check every value against the dictionary: allowed values for enums, whole numbers for integers, amounts of 0
or more for decimals, true/false for booleans, and required attributes present. Check that a total is not
less than the taxes, fees and extras it includes. A case that expects an HTTP 4xx breaks the spec on purpose;
mark its data set a negative test. Any other data set that breaks the spec is reported, never silently fixed.

Never copy production records and never invent an attribute the dictionary does not define. In an
incremental cycle keep the baseline's data set when the case's drivers are unchanged, and regenerate it
(version + 1) when they changed.

Hand the data sets to the automation agent: each spec loads test-data/<case key>.json and only overrides
the drivers its case states.
