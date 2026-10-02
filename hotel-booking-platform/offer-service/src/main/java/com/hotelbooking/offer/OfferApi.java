package com.hotelbooking.offer;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.hotelbooking.common.money.Money;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

/** Request and response shapes for offer-service. */
public final class OfferApi {

    private OfferApi() {
    }

    /** Approved interest categories. Free text and sensitive traits are not accepted (story 5.1 BR). */
    public enum Interest {
        DINING,
        WELLNESS,
        SIGHTSEEING,
        FAMILY,
        BUSINESS,
        ROMANCE,
        TRANSPORT
    }

    public enum PricingUnit {
        PER_STAY,
        PER_NIGHT
    }

    public enum Action {
        ADD,
        SKIP,
        DISMISS
    }

    public record OfferContext(@NotBlank String hotelId, @NotBlank String destination, @NotNull LocalDate checkIn,
            @NotNull LocalDate checkOut, String roomCode, String ratePlanCode, @Min(1) int adults, @Min(0) int children,
            @NotBlank String currency, List<String> hotelAmenities, List<Interest> declaredInterests, String profileId,
            String sessionId) {
    }

    /** Story 5.2: name, description, price, currency, applicability, restrictions; marked as optional. */
    public record Offer(String code, String name, String description, Interest category, Money unitPrice,
            PricingUnit pricingUnit, Money priceForStay, String currency, String applicability, String restrictions,
            int maxQuantity, String kind, String kindLabel, List<String> reasonCodes, boolean personalized) {
    }

    public record Exclusion(String code, String reason) {
    }

    public record OfferResponse(List<Offer> offers, boolean personalized, boolean contextualDefaults, String disclosure,
            String fallbackReason, String rulesVersion, String modelVersion, List<Exclusion> excluded,
            boolean proceedWithoutOffers) {
    }

    public record Interaction(@NotBlank String sessionId, @NotBlank String offerCode, @NotNull Action action) {
    }

    public record ConsentRequest(boolean personalization, List<Interest> interests) {
    }

    public record Consent(String profileId, boolean personalization, List<Interest> interests, Instant grantedAt,
            Instant expiresAt) {
    }

    public record ItemRequest(@NotBlank String code, @Min(1) int quantity) {
    }

    public record ValidationRequest(@NotNull @Valid OfferContext context, @NotEmpty List<@Valid ItemRequest> items) {
    }

    public record ItemValidation(String code, String name, boolean eligible, boolean available, int quantity,
            int maxQuantity, boolean quantityAllowed, Money unitPrice, PricingUnit pricingUnit, Money linePrice,
            String reason) {
    }

    public record ValidationResponse(List<ItemValidation> items, String rulesVersion) {
    }
}
