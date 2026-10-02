package com.hotelbooking.search;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import com.hotelbooking.common.web.FieldIssue;

/** Request and response shapes for search-service. */
public final class SearchApi {

    private SearchApi() {
    }

    public enum Status {
        RESULTS,
        NO_AVAILABILITY,
        SERVICE_UNAVAILABLE
    }

    /** All fields nullable so the server can report every missing field at once (story 3.2). */
    public record SearchRequest(String destination, LocalDate checkIn, LocalDate checkOut, Integer rooms, Integer adults,
            Integer children) {
    }

    public record Criteria(String destination, LocalDate checkIn, LocalDate checkOut, int rooms, int adults, int children,
            long nights) {
    }

    public record Money(BigDecimal amount, String currency) {
    }

    /** Subset of hotel-service's result card that search exposes (story 4.1 fields). */
    public record HotelCard(String hotelId, String name, String city, double distanceKm, int category, String image,
            List<String> amenities, Money startingNightly, Money startingStayTotal, String currency, String availability,
            boolean bookable, String priceQualification) {
    }

    public record AppliedFilter(String name, String value, String removeHint) {
    }

    public record HotelPage(List<HotelCard> results, int page, int size, int totalResults, int totalPages,
            int unfilteredResults, String sort, List<String> sortOptions, List<AppliedFilter> appliedFilters,
            boolean resetAvailable, List<String> availableAmenities) {
    }

    public record Suggestion(String action, String label, SearchRequest criteria) {
    }

    /** Criteria are echoed so they stay visible and editable on the results page (story 3.1 AC2). */
    public record SearchResponse(String searchId, String sessionId, Status status, Criteria criteria, String message,
            boolean retryable, List<Suggestion> suggestions, HotelPage page) {
    }

    public record FieldSpec(String name, String label, String type, boolean required, String constraint, String hint,
            String errorId) {
    }

    /** Story 3.2 AC1, AC4: required fields are identified; errors are linked to fields for assistive technology. */
    public record FormSpec(List<FieldSpec> fields, String errorSummaryRole, String errorSummaryLive, String rulesVersion) {
    }

    public record ValidationResult(boolean valid, List<FieldIssue> fieldIssues) {
    }
}
