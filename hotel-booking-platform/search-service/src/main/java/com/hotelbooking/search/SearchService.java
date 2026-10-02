package com.hotelbooking.search;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.hotelbooking.common.events.EventNames;
import com.hotelbooking.common.events.EventPublisher;
import com.hotelbooking.common.privacy.Masking;
import com.hotelbooking.common.resilience.DependencyUnavailableException;
import com.hotelbooking.common.web.ApiException;
import com.hotelbooking.common.web.FieldIssue;
import com.hotelbooking.search.SearchApi.Criteria;
import com.hotelbooking.search.SearchApi.HotelPage;
import com.hotelbooking.search.SearchApi.SearchRequest;
import com.hotelbooking.search.SearchApi.SearchResponse;
import com.hotelbooking.search.SearchApi.Status;
import com.hotelbooking.search.SearchApi.Suggestion;

import reactor.core.publisher.Mono;

/**
 * Creates searches. The same criteria submitted again in the same session within the session TTL returns the
 * same search id, so double submits do not create inconsistent sessions (story 3.3 AC3).
 */
@Service
public class SearchService {

    record StoredSearch(String searchId, String sessionId, Criteria criteria, Instant createdAt) {
    }

    private final SearchValidator validator;
    private final SearchRules rules;
    private final HotelClient hotels;
    private final EventPublisher events;
    private final Clock clock;
    private final Map<String, StoredSearch> byId = new ConcurrentHashMap<>();
    private final Map<String, String> bySessionAndCriteria = new ConcurrentHashMap<>();

    public SearchService(SearchValidator validator, SearchRules rules, HotelClient hotels, EventPublisher events, Clock clock) {
        this.validator = validator;
        this.rules = rules;
        this.hotels = hotels;
        this.events = events;
        this.clock = clock;
    }

    public Mono<SearchResponse> search(SearchRequest request, String sessionHeader) {
        long started = System.nanoTime();
        List<FieldIssue> issues = validator.validate(request);
        if (!issues.isEmpty()) {
            return events.event(EventNames.SEARCH_VALIDATED).outcome("rejected")
                    .attr("rules", issues.stream().map(FieldIssue::ruleId).toList()).publish()
                    .then(Mono.error(new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED",
                            "Please correct the highlighted search details.", false, issues)));
        }
        Criteria criteria = normalise(request);
        StoredSearch stored = remember(sessionHeader, criteria);
        return events.event(EventNames.SEARCH_SUBMITTED).attr("searchId", stored.searchId())
                .attr("destination", criteria.destination()).attr("nights", criteria.nights())
                .attr("rooms", criteria.rooms()).publish()
                .then(run(stored, Map.of(), started));
    }

    public Mono<SearchResponse> refine(String searchId, Map<String, String> refinements) {
        StoredSearch stored = Optional.ofNullable(byId.get(searchId)).orElseThrow(() -> new ApiException(
                HttpStatus.NOT_FOUND, "SEARCH_NOT_FOUND", "That search has expired. Please search again."));
        return run(stored, refinements, System.nanoTime());
    }

    private Mono<SearchResponse> run(StoredSearch s, Map<String, String> refinements, long started) {
        Criteria c = s.criteria();
        return hotels.availability(c, refinements)
                .flatMap(page -> {
                    boolean any = page.results().stream().anyMatch(SearchApi.HotelCard::bookable);
                    boolean filtered = page.resetAvailable();
                    Status status = any ? Status.RESULTS : Status.NO_AVAILABILITY;
                    String message = any ? null : filtered
                            ? "No hotels match the filters you applied. Remove a filter or reset all filters."
                            : "We found no available rooms matching your search. Try changing your dates, the number of rooms or guests, or the destination.";
                    SearchResponse response = new SearchResponse(s.searchId(), s.sessionId(), status, c, message, false,
                            any ? List.of() : suggestions(c, filtered), page);
                    return events.event(EventNames.RESULTS_IMPRESSION).outcome(status.name().toLowerCase(Locale.ROOT))
                            .attr("searchId", s.searchId()).attr("results", page.totalResults())
                            .duration(elapsed(started)).publish().thenReturn(response);
                })
                .onErrorResume(DependencyUnavailableException.class, e -> events.event(EventNames.SEARCH_FAILED)
                        .error(e.category().name()).attr("searchId", s.searchId()).attr("dependency", e.dependency())
                        .duration(elapsed(started)).publish()
                        .thenReturn(new SearchResponse(s.searchId(), s.sessionId(), Status.SERVICE_UNAVAILABLE, c,
                                "We couldn't load hotels right now. Your search details are saved, please try again.",
                                true, List.of(new Suggestion("RETRY", "Try again", request(c))), null)));
    }

    private StoredSearch remember(String sessionHeader, Criteria criteria) {
        String sessionId = sessionHeader == null || sessionHeader.isBlank() ? UUID.randomUUID().toString() : sessionHeader;
        String key = Masking.fingerprint(sessionId, criteria.destination(), criteria.checkIn().toString(),
                criteria.checkOut().toString(), String.valueOf(criteria.rooms()), String.valueOf(criteria.adults()),
                String.valueOf(criteria.children()));
        Instant now = clock.instant();
        synchronized (this) {
            String existing = bySessionAndCriteria.get(key);
            StoredSearch previous = existing == null ? null : byId.get(existing);
            if (previous != null && previous.createdAt().plus(rules.getSessionTtl()).isAfter(now)) {
                return previous;
            }
            StoredSearch created = new StoredSearch("S-" + UUID.randomUUID().toString().substring(0, 8), sessionId, criteria, now);
            byId.put(created.searchId(), created);
            bySessionAndCriteria.put(key, created.searchId());
            return created;
        }
    }

    public int storedSearches() {
        return byId.size();
    }

    private List<Suggestion> suggestions(Criteria c, boolean filtered) {
        List<Suggestion> out = new ArrayList<>();
        if (filtered) {
            out.add(new Suggestion("RESET_FILTERS", "Reset all filters", request(c)));
        }
        out.add(new Suggestion("CHANGE_DATES", "Try one day later",
                new SearchRequest(c.destination(), c.checkIn().plusDays(1), c.checkOut().plusDays(1), c.rooms(), c.adults(), c.children())));
        if (c.rooms() > 1 || c.adults() > 1 || c.children() > 0) {
            out.add(new Suggestion("CHANGE_OCCUPANCY", "Search for fewer guests",
                    new SearchRequest(c.destination(), c.checkIn(), c.checkOut(), 1, 1, 0)));
        }
        rules.getDestinations().stream().filter(d -> !d.equalsIgnoreCase(c.destination())).findFirst()
                .ifPresent(d -> out.add(new Suggestion("CHANGE_DESTINATION", "Try " + d,
                        new SearchRequest(d, c.checkIn(), c.checkOut(), c.rooms(), c.adults(), c.children()))));
        return out;
    }

    private static SearchRequest request(Criteria c) {
        return new SearchRequest(c.destination(), c.checkIn(), c.checkOut(), c.rooms(), c.adults(), c.children());
    }

    private static Criteria normalise(SearchRequest r) {
        int children = r.children() == null ? 0 : r.children();
        return new Criteria(r.destination().trim().toUpperCase(Locale.ROOT), r.checkIn(), r.checkOut(), r.rooms(),
                r.adults(), children, ChronoUnit.DAYS.between(r.checkIn(), r.checkOut()));
    }

    private static long elapsed(long started) {
        return (System.nanoTime() - started) / 1_000_000;
    }
}
