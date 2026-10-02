package com.hotelbooking.cart;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.hotelbooking.common.money.Money;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** Request and response shapes for cart-service, plus mirrors of the hotel and offer responses it consumes. */
public final class CartApi {

    private CartApi() {
    }

    public enum Status {
        ACTIVE,
        EXPIRED,
        CHECKED_OUT
    }

    public enum LineType {
        ROOM,
        TAX,
        MANDATORY_FEE,
        OPTIONAL_EXTRA,
        DISCOUNT
    }

    public record CreateCartRequest(@NotBlank String hotelId, @NotBlank String roomCode, @NotBlank String ratePlanCode,
            @NotNull LocalDate checkIn, @NotNull LocalDate checkOut, @Min(1) int rooms, @Min(1) int adults,
            @Min(0) int children, String priceVersion, String sessionId) {
    }

    public record ChangeRoomRequest(@NotBlank String roomCode, @NotBlank String ratePlanCode) {
    }

    public record AncillaryRequest(@NotBlank String code, @Min(1) int quantity) {
    }

    public record QuantityRequest(@Min(0) int quantity) {
    }

    public record AcknowledgeRequest(@NotBlank String priceVersion) {
    }

    public record CompleteRequest(@NotBlank String reservationId) {
    }

    /** Story 6.1 AC1: hotel, room, rate, dates, occupancy, quantity, currency and price components. */
    public record RoomSelection(String hotelId, String hotelName, String city, String address, String checkInFrom,
            String checkOutUntil, String destination,
            List<String> hotelAmenities, String roomCode, String roomName, String ratePlanCode, String ratePlanName,
            LocalDate checkIn, LocalDate checkOut, long nights, int rooms, int adults, int children, String currency,
            Money roomCharge, Money taxes, Money mandatoryFees, Money total, String paymentRule, boolean refundable,
            String cancellationTerms, String restrictions, String priceVersion) {
    }

    public record AncillaryLine(String code, String name, int quantity, int maxQuantity, Money unitPrice,
            String pricingUnit, Money linePrice) {
    }

    public record Line(LineType type, String label, int quantity, Money amount) {
    }

    public record Totals(Money roomCharge, Money taxes, Money mandatoryFees, Money optionalExtras, Money discounts,
            Money total) {
    }

    /** Story 6.3 AC3: what changed and by how much; must be acknowledged before checkout. */
    public record PendingChange(Money previousTotal, Money newTotal, Money difference, List<String> reasons) {
    }

    public record CartView(String cartId, Status status, Instant createdAt, Instant expiresAt, long secondsRemaining,
            String timeoutBehaviour, RoomSelection room, List<AncillaryLine> ancillaries, List<Line> lines,
            Totals totals, String currency, String priceVersion, PendingChange pendingChange,
            boolean requiresAcknowledgement, List<String> notices, List<String> editActions, String reservationId,
            String note) {
    }

    // ---- hotel-service quote mirror ----
    public record QuoteRequest(String roomCode, String ratePlanCode, LocalDate checkIn, LocalDate checkOut, int rooms,
            int adults, int children, String expectedPriceVersion) {
    }

    public record Quote(String hotelId, String hotelName, String city, String address, String checkInFrom,
            String checkOutUntil, String destination, List<String> hotelAmenities,
            String roomCode, String roomName, String ratePlanCode, String ratePlanName, LocalDate checkIn,
            LocalDate checkOut, long nights, int rooms, int adults, int children, String currency, Money roomCharge,
            Money taxes, Money mandatoryFees, Money total, String paymentRule, boolean refundable,
            String cancellationTerms, String restrictions, int roomsLeft, boolean available, String priceVersion,
            boolean priceChanged, String notice) {
    }

    // ---- offer-service validation mirror ----
    public record OfferContext(String hotelId, String destination, LocalDate checkIn, LocalDate checkOut,
            String roomCode, String ratePlanCode, int adults, int children, String currency, List<String> hotelAmenities,
            List<String> declaredInterests, String profileId, String sessionId) {
    }

    public record OfferItem(String code, int quantity) {
    }

    public record OfferValidationRequest(OfferContext context, List<OfferItem> items) {
    }

    public record OfferItemValidation(String code, String name, boolean eligible, boolean available, int quantity,
            int maxQuantity, boolean quantityAllowed, Money unitPrice, String pricingUnit, Money linePrice,
            String reason) {
    }

    public record OfferValidationResponse(List<OfferItemValidation> items, String rulesVersion) {
    }
}
