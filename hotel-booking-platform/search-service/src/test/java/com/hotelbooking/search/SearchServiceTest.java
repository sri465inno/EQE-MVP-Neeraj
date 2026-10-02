package com.hotelbooking.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.reactive.server.WebTestClient;

import com.fasterxml.jackson.databind.JsonNode;
import com.hotelbooking.common.resilience.DependencyUnavailableException;
import com.hotelbooking.search.SearchApi.HotelCard;
import com.hotelbooking.search.SearchApi.HotelPage;
import com.hotelbooking.search.SearchApi.Money;

import reactor.core.publisher.Mono;

/** Epic 1 (AQPI-2) stories 3.1-3.3 with the hotel dependency stubbed. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "spring.config.name=search-service")
class SearchServiceTest {

    private static final LocalDate IN = LocalDate.now().plusDays(20);

    @Autowired
    WebTestClient web;

    @MockitoBean
    HotelClient hotels;

    @Test
    @DisplayName("AQPI-3 3.1: a valid search returns results with the criteria echoed and is idempotent per session")
    void searchResults() {
        when(hotels.availability(any(), any())).thenReturn(Mono.just(page()));
        JsonNode first = search("session-1", HttpStatus.OK);
        assertThat(first.path("status").asText()).isEqualTo("RESULTS");
        assertThat(first.path("criteria").path("destination").asText()).isEqualTo("NYC");
        assertThat(first.path("criteria").path("nights").asInt()).isEqualTo(2);
        assertThat(search("session-1", HttpStatus.OK).path("searchId").asText()).isEqualTo(first.path("searchId").asText());
        assertThat(search("session-2", HttpStatus.OK).path("searchId").asText()).isNotEqualTo(first.path("searchId").asText());
    }

    @Test
    @DisplayName("AQPI-4 AQPI-30 3.2 9.3: every rule is reported per field and the form exposes accessible error metadata")
    void validationRules() {
        JsonNode result = web.post().uri("/api/searches/validate")
                .bodyValue(Map.of("destination", "", "checkIn", LocalDate.now().minusDays(1), "checkOut",
                        LocalDate.now().minusDays(2), "rooms", 0, "adults", 0, "children", -1))
                .exchange().expectStatus().isOk().expectBody(JsonNode.class).returnResult().getResponseBody();
        assertThat(result.path("valid").asBoolean()).isFalse();
        List<String> rules = new ArrayList<>();
        result.path("fieldIssues").forEach(i -> rules.add(i.path("ruleId").asText()));
        assertThat(rules).contains("destination.required", "checkIn.past", "checkOut.notAfterCheckIn",
                "rooms.range", "children.negative");

        JsonNode form = web.get().uri("/api/searches/form").exchange().expectStatus().isOk().expectBody(JsonNode.class)
                .returnResult().getResponseBody();
        assertThat(form.path("errorSummaryRole").asText()).isNotBlank();
        assertThat(form.path("fields").size()).isGreaterThanOrEqualTo(6);
    }

    @Test
    @DisplayName("AQPI-5 AQPI-31: an unavailable hotel service gives a retryable, plain-language response")
    void dependencyUnavailable() {
        when(hotels.availability(any(), any())).thenReturn(Mono.error(new DependencyUnavailableException(
                HotelClient.DEPENDENCY, DependencyUnavailableException.Category.TIMEOUT, new RuntimeException())));
        JsonNode response = search("session-3", HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.path("status").asText()).isEqualTo("SERVICE_UNAVAILABLE");
        assertThat(response.path("retryable").asBoolean()).isTrue();
        assertThat(response.path("message").asText()).doesNotContain("Exception").doesNotContain("timeout");
    }

    @Test
    @DisplayName("AQPI-5 3.3: no availability suggests alternatives")
    void noAvailability() {
        when(hotels.availability(any(), any())).thenReturn(Mono.just(new HotelPage(List.of(), 0, 10, 0, 0, 0,
                "RECOMMENDED", List.of(), List.of(), false, List.of())));
        JsonNode response = search("session-4", HttpStatus.OK);
        assertThat(response.path("status").asText()).isEqualTo("NO_AVAILABILITY");
        assertThat(response.path("suggestions").size()).isPositive();
    }

    private JsonNode search(String session, HttpStatus expected) {
        return web.post().uri("/api/searches").header(SearchController.SESSION_HEADER, session)
                .bodyValue(Map.of("destination", "NYC", "checkIn", IN, "checkOut", IN.plusDays(2), "rooms", 1,
                        "adults", 2, "children", 0))
                .exchange().expectStatus().isEqualTo(expected).expectBody(JsonNode.class).returnResult()
                .getResponseBody();
    }

    private static HotelPage page() {
        Money nightly = new Money(new BigDecimal("195.00"), "USD");
        HotelCard card = new HotelCard("H-NYC-001", "Harbor View Hotel", "New York", 1.2, 4, "img", List.of("wifi"),
                nightly, new Money(new BigDecimal("390.00"), "USD"), "USD", "AVAILABLE", true, "per night");
        return new HotelPage(List.of(card), 0, 10, 1, 1, 1, "RECOMMENDED", List.of("RECOMMENDED"), List.of(), false,
                List.of("wifi"));
    }
}
