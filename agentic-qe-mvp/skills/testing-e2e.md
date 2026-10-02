---
id: testing-e2e
name: End-to-end testing from the user's point of view
description: Steers the design agents to write journeys as the guest experiences them, from search to confirmation.
testingType: e2e
appliesTo: [testcases, scripts, execution]
delivers:
  testcases: [journeys]
  execution: [screenshots]
---

Write each case as a journey the guest performs: search, open the hotel, pick a room and rate, add extras, review
the cart, pay and receive the confirmation. The name says what the guest gets ("Guest books a flexible room in
Paris and receives the confirmation e-mail"), not what one endpoint returns.

Every journey checks what the guest is told at each step: the price, the reservation status and the confirmation
number, exactly as the system returns them.

Keep the evidence of every step (a screenshot where there is a screen, otherwise each request and response); it is
what a product owner looks at.

API-only checks and response times are out of scope for an end-to-end run.
