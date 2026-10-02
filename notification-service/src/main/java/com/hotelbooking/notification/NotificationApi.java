package com.hotelbooking.notification;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.hotelbooking.common.money.Money;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** Request and response shapes for notification-service. */
public final class NotificationApi {

    private NotificationApi() {
    }

    public enum DeliveryStatus {
        QUEUED,
        SENT,
        DELIVERED,
        BOUNCED,
        FAILED
    }

    public enum Kind {
        CONFIRMATION,
        RESEND,
        CANCELLATION
    }

    public record HotelInfo(@NotBlank String name, String address, String city, String checkInFrom, String checkOutUntil) {
    }

    public record Item(@NotBlank String label, int quantity, @NotNull Money amount) {
    }

    /** Only the personal data the message needs (story 8.1 BR); no payment details. */
    public record ConfirmationRequest(@NotBlank String reservationId, @NotBlank String confirmationNumber,
            @NotBlank String status, String locale, @NotBlank String guestFirstName, @NotBlank String guestLastName,
            @NotBlank @Email String guestEmail, @NotNull @Valid HotelInfo hotel, @NotNull LocalDate checkIn,
            @NotNull LocalDate checkOut, long nights, int rooms, int adults, int children, String roomName,
            String ratePlanName, List<@Valid Item> items, @NotNull Money total, String paymentRule,
            String cancellationTerms, Boolean refundable) {
    }

    public record StatusChange(DeliveryStatus status, Instant at, String detail) {
    }

    public record MessageView(String messageId, String reservationId, String confirmationNumber, Kind kind,
            String locale, String templateVersion, String recipient, DeliveryStatus status, int attempts,
            List<StatusChange> history, String subject, String html, String text, Instant createdAt) {
    }

    public record ResendRequest(@NotBlank String confirmationNumber, @NotBlank String lastName) {
    }

    public record ResendResponse(String message) {
    }

    public record Webhook(@NotBlank String providerMessageId, @NotNull DeliveryStatus event) {
    }
}
