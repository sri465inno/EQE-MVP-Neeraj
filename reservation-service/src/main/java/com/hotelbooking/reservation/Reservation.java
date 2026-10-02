package com.hotelbooking.reservation;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import com.hotelbooking.common.money.Money;
import com.hotelbooking.reservation.ReservationApi.CartSnapshot;
import com.hotelbooking.reservation.ReservationApi.InventoryStatus;
import com.hotelbooking.reservation.ReservationApi.PaymentStatus;
import com.hotelbooking.reservation.ReservationApi.Status;

/** Reservation record. Personal fields are stored AES-GCM sealed; no card data is ever held. */
final class Reservation {

    final String id;
    final String idempotencyKey;
    final String fingerprint;
    final String cartId;
    final Instant createdAt;
    final List<String> history = new ArrayList<>();
    Status status = Status.PROCESSING;
    PaymentStatus paymentStatus = PaymentStatus.NOT_ATTEMPTED;
    InventoryStatus inventoryStatus = InventoryStatus.NOT_COMMITTED;
    String confirmationNumber;
    CartSnapshot cart;
    Money authorizedAmount;
    String paymentToken;
    String firstNameSealed;
    String lastNameSealed;
    String emailSealed;
    String phoneSealed;
    String locale;
    boolean marketingOptIn;
    String privacyNoticeVersion;
    String notificationStatus = "NOT_REQUESTED";
    String failureCode;
    boolean anonymized;
    Instant updatedAt;

    Reservation(String id, String idempotencyKey, String fingerprint, String cartId, Instant createdAt) {
        this.id = id;
        this.idempotencyKey = idempotencyKey;
        this.fingerprint = fingerprint;
        this.cartId = cartId;
        this.createdAt = createdAt;
        this.updatedAt = createdAt;
    }
}
