package com.hotelbooking.search;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

import com.hotelbooking.common.web.FieldIssue;
import com.hotelbooking.search.SearchApi.FieldSpec;
import com.hotelbooking.search.SearchApi.FormSpec;
import com.hotelbooking.search.SearchApi.SearchRequest;

/** Authoritative server-side validation for search criteria (stories 3.1 AC3, 3.2). */
@Component
public class SearchValidator {

    public static final String RULES_VERSION = "search-rules-v1";
    private static final Pattern DESTINATION = Pattern.compile("[\\p{L} .'-]{2,60}");

    private final SearchRules rules;
    private final Clock clock;

    public SearchValidator(SearchRules rules, Clock clock) {
        this.rules = rules;
        this.clock = clock;
    }

    public LocalDate today() {
        return LocalDate.now(clock.withZone(ZoneId.of(rules.getZone())));
    }

    public List<FieldIssue> validate(SearchRequest r) {
        List<FieldIssue> issues = new ArrayList<>();
        SearchRules.Limits limits = rules.limitsFor(r.destination());
        LocalDate today = today();
        if (r.destination() == null || r.destination().isBlank()) {
            issues.add(new FieldIssue("destination", "destination.required", "Enter a destination, for example New York."));
        } else if (!DESTINATION.matcher(r.destination().trim()).matches()) {
            issues.add(new FieldIssue("destination", "destination.format",
                    "Destination can only contain letters, spaces, apostrophes and hyphens (2 to 60 characters)."));
        }
        if (r.checkIn() == null) {
            issues.add(new FieldIssue("checkIn", "checkIn.required", "Enter a check-in date."));
        } else if (r.checkIn().isBefore(today)) {
            issues.add(new FieldIssue("checkIn", "checkIn.past", "Check-in date cannot be in the past. Choose today or a later date."));
        } else if (ChronoUnit.DAYS.between(today, r.checkIn()) > limits.getMaxAdvanceDays()) {
            issues.add(new FieldIssue("checkIn", "checkIn.tooFarAhead",
                    "Bookings can be made up to " + limits.getMaxAdvanceDays() + " days ahead. Choose an earlier check-in date."));
        }
        if (r.checkOut() == null) {
            issues.add(new FieldIssue("checkOut", "checkOut.required", "Enter a check-out date."));
        } else if (r.checkIn() != null && !r.checkOut().isAfter(r.checkIn())) {
            issues.add(new FieldIssue("checkOut", "checkOut.notAfterCheckIn", "Check-out date must be after the check-in date."));
        } else if (r.checkIn() != null && ChronoUnit.DAYS.between(r.checkIn(), r.checkOut()) > limits.getMaxStayNights()) {
            issues.add(new FieldIssue("checkOut", "stay.tooLong",
                    "Stays can be up to " + limits.getMaxStayNights() + " nights. Shorten your stay."));
        }
        if (r.rooms() == null) {
            issues.add(new FieldIssue("rooms", "rooms.required", "Enter the number of rooms."));
        } else if (r.rooms() < 1 || r.rooms() > limits.getMaxRooms()) {
            issues.add(new FieldIssue("rooms", "rooms.range", "Choose between 1 and " + limits.getMaxRooms() + " rooms."));
        }
        if (r.adults() == null) {
            issues.add(new FieldIssue("adults", "adults.required", "Enter the number of adults."));
        } else if (r.rooms() != null && r.rooms() >= 1) {
            if (r.adults() < r.rooms()) {
                issues.add(new FieldIssue("adults", "adults.perRoom", "Each room needs at least one adult."));
            } else if (r.adults() > r.rooms() * limits.getMaxAdultsPerRoom()) {
                issues.add(new FieldIssue("adults", "adults.max", "Up to " + limits.getMaxAdultsPerRoom()
                        + " adults per room are allowed. Add a room or reduce the number of adults."));
            }
        }
        int children = r.children() == null ? 0 : r.children();
        if (children < 0) {
            issues.add(new FieldIssue("children", "children.negative", "Number of children cannot be negative."));
        } else if (r.rooms() != null && r.rooms() >= 1 && children > r.rooms() * limits.getMaxChildrenPerRoom()) {
            issues.add(new FieldIssue("children", "children.max", "Up to " + limits.getMaxChildrenPerRoom()
                    + " children per room are allowed. Add a room or reduce the number of children."));
        }
        return issues;
    }

    public FormSpec form() {
        SearchRules.Limits d = rules.getDefaults();
        return new FormSpec(List.of(
                new FieldSpec("destination", "Destination", "text", true, "2-60 letters", "City or area, for example New York", "destination-error"),
                new FieldSpec("checkIn", "Check-in date", "date", true, "today or later, up to " + d.getMaxAdvanceDays() + " days ahead", "Format YYYY-MM-DD", "checkIn-error"),
                new FieldSpec("checkOut", "Check-out date", "date", true, "after check-in, up to " + d.getMaxStayNights() + " nights", "Format YYYY-MM-DD", "checkOut-error"),
                new FieldSpec("rooms", "Rooms", "number", true, "1-" + d.getMaxRooms(), null, "rooms-error"),
                new FieldSpec("adults", "Adults", "number", true, "at least 1 per room, up to " + d.getMaxAdultsPerRoom() + " per room", null, "adults-error"),
                new FieldSpec("children", "Children", "number", false, "0-" + d.getMaxChildrenPerRoom() + " per room", "Optional", "children-error")),
                "alert", "assertive", RULES_VERSION);
    }
}
