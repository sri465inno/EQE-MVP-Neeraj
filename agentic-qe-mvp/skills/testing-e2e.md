---
id: testing-e2e
name: End-to-end testing from the user's point of view
description: Steers the design agents to write browser journeys as the travel advisor experiences them.
testingType: e2e
appliesTo: [testcases, scripts, execution]
delivers:
  testcases: [journeys]
  execution: [screenshots]
---

Write each case as a journey the travel advisor performs: store a reservation, open the commission statement, look
the reservation up and read the breakdown. The name says what the advisor sees ("Advisor sees the long-stay bonus on
the statement for a 7-night stay"), not what the API returns.

Every journey checks the lines the advisor sees on the statement and the total they will be paid, formatted exactly
as the page shows it (for example "USD 92.00").

Keep a screenshot of the statement for every journey; it is the evidence a product owner looks at.

API-only checks and response times are out of scope for an end-to-end run.
