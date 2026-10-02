package com.hotelbooking.common.privacy;

import java.util.List;

/**
 * Where each personal or payment attribute is stored and processed (story 9.1 AC1). Kept in code so tests
 * can assert that nothing classified PAYMENT is ever stored by a booking service.
 */
public final class DataMap {

    public record Entry(String attribute, DataClass dataClass, String storedIn, String processing, String retention) {
    }

    public static final List<Entry> ENTRIES = List.of(
            new Entry("destination", DataClass.PUBLIC, "search-service (in memory)", "search", "session"),
            new Entry("guest.firstName", DataClass.PERSONAL, "reservation-service", "reservation, confirmation", "policy: stay + 24 months"),
            new Entry("guest.lastName", DataClass.PERSONAL, "reservation-service", "reservation, resend verification (hashed)", "policy: stay + 24 months"),
            new Entry("guest.email", DataClass.PERSONAL, "reservation-service, notification-service", "confirmation e-mail; masked elsewhere", "policy: stay + 24 months"),
            new Entry("guest.phone", DataClass.PERSONAL, "reservation-service", "hotel contact; masked elsewhere", "policy: stay + 24 months"),
            new Entry("consent.interests", DataClass.PERSONAL, "offer-service", "personalised offers, only with consent", "until consent withdrawn"),
            new Entry("payment.token", DataClass.PAYMENT, "payment provider only; reservation stores the provider reference", "authorisation", "provider policy"),
            new Entry("card.number", DataClass.PAYMENT, "never stored by this platform", "provider hosted fields only", "n/a"));

    private DataMap() {
    }
}
