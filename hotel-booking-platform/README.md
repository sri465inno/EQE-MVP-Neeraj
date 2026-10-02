# Hotel booking platform (AQPI)

Java 21 + Spring Boot 3.5 + WebFlux reactive microservices for the "Intelligent Hotel Shopping and Reservation Experience" initiative (Jira AQPI-1). Every story AQPI-3 to AQPI-31 is mapped to code and tests in [TRACEABILITY.md](TRACEABILITY.md).

| Module | Port | Epic | What it does |
|---|---|---|---|
| platform-common | - | AQPI-27 | Correlation IDs, masking, AES-GCM field encryption, versioned business events, timeouts/retries/circuit breakers, money, error contract |
| hotel-service | 8081 | AQPI-6 | Hotel catalog, availability, sort/filter/paging, details, quotes, inventory commitments |
| search-service | 8082 | AQPI-2 | Search validation, session-idempotent searches, no-availability suggestions, dependency fallback |
| offer-service | 8083 | AQPI-10 | Eligible ancillary offers, consent-aware personalisation, dismissals, cart validation |
| cart-service | 8084 | AQPI-14 | Cart with 30-minute expiry, optional extras, revalidation, price-change acknowledgement |
| reservation-service | 8085 | AQPI-18 | Guest validation, tokenised payment, idempotent reservation, reconciliation, manual review, privacy views |
| notification-service | 8086 | AQPI-23 | Accessible localised confirmation e-mail, delivery tracking, retry, safe resend |
| journey-tests | - | all | Starts all six services in one JVM and runs end-to-end booking journeys |

## Build and test

```bash
export JAVA_HOME=/path/to/jdk-21
mvn -B install            # all modules, 49 tests
mvn -B -pl journey-tests -am test   # end-to-end journeys only
```

Run a service: `mvn -pl hotel-service -am spring-boot:run` (start hotel, offer and notification first, then search, cart and reservation).

## Demo switches

- Payment tokens: `tok_visa_ok` authorises, `tok_decline` declines, `tok_error` fails, `tok_timeout` loses the response (reservation goes to PENDING_UNKNOWN and is reconciled), `tok_void_fails` makes a void fail (MANUAL_REVIEW).
- E-mail domains: `@fail.test` always fails, `@flaky.test` fails once then succeeds, `@bounce.test` bounces.
- `POST /api/admin/reset` on each service restores the seeded data.

## Limitations

- Storage is in memory; restarting a service loses its data.
- Payment and e-mail providers are simulated.
- No browser UI: accessibility is covered for the search form contract and the e-mail template only.
- Load and performance targets (AQPI-31) are not measured; timeouts, retries and fallbacks are tested.
- Built and tested on Java 21. The code uses no Java 22+ features; Java 25 has not been tested.
