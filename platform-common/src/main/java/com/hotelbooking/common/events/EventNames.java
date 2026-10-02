package com.hotelbooking.common.events;

/** Event taxonomy shared across search, selection, offers, cart, checkout, reservation and e-mail (story 9.2). */
public final class EventNames {

    public static final int SCHEMA_VERSION = 1;

    public static final String SEARCH_SUBMITTED = "search.submitted";
    public static final String SEARCH_VALIDATED = "search.validated";
    public static final String SEARCH_FAILED = "search.failed";
    public static final String RESULTS_IMPRESSION = "results.impression";
    public static final String RESULTS_REFINED = "results.refined";
    public static final String HOTEL_VIEWED = "hotel.viewed";
    public static final String RATE_SELECTED = "rate.selected";
    public static final String OFFERS_RECOMMENDED = "offers.recommended";
    public static final String OFFER_INTERACTION = "offer.interaction";
    public static final String CONSENT_CHANGED = "consent.changed";
    public static final String CART_UPDATED = "cart.updated";
    public static final String CART_VIEWED = "cart.viewed";
    public static final String CART_PRICE_ACKNOWLEDGED = "cart.price.acknowledged";
    public static final String CHECKOUT_FORM = "checkout.form";
    public static final String PAYMENT_AUTHORISATION = "payment.authorisation";
    public static final String RESERVATION_STATUS = "reservation.status";
    public static final String OUTCOME_VIEWED = "outcome.viewed";
    public static final String CONFIRMATION_GENERATED = "confirmation.generated";
    public static final String EMAIL_STATUS = "email.status";
    public static final String RESEND_REQUESTED = "confirmation.resend";
    public static final String CANCELLATION_REQUESTED = "reservation.cancellation";
    public static final String AUDIT_ACCESS = "audit.access";

    private EventNames() {
    }
}
