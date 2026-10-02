package com.hotelbooking.notification;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.reactive.server.WebTestClient;

import com.fasterxml.jackson.databind.JsonNode;

/** Epic 6 (AQPI-23) stories 8.1-8.3. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "spring.config.name=notification-service")
class NotificationServiceTest {

    @Autowired
    WebTestClient web;

    @BeforeEach
    void reset() {
        web.post().uri("/api/admin/reset").exchange().expectStatus().is2xxSuccessful();
    }

    @Test
    @DisplayName("AQPI-24 AQPI-30 8.1 9.3: accessible, localised confirmation with escaped guest content and no card data")
    void accessibleTemplate() {
        JsonNode message = confirm("R-1", "HBTEST0001", "<b>Jane</b>", "jane@example.com", "fr-FR", HttpStatus.CREATED);
        String html = message.path("html").asText();
        assertThat(html).contains("lang=\"fr-FR\"", "<caption>", "scope=\"col\"", "&lt;b&gt;Jane&lt;/b&gt;")
                .doesNotContain("<b>Jane</b>").doesNotContain("4111");
        assertThat(message.path("text").asText()).contains("HBTEST0001");
        assertThat(message.path("recipient").asText()).isEqualTo("j***@e***.com");
    }

    @Test
    @DisplayName("AQPI-25 8.2: one confirmation per reservation; unconfirmed reservations are refused")
    void idempotentConfirmation() {
        String id = confirm("R-2", "HBTEST0002", "Jane", "jane@example.com", "en-GB", HttpStatus.CREATED)
                .path("messageId").asText();
        assertThat(confirm("R-2", "HBTEST0002", "Jane", "jane@example.com", "en-GB", HttpStatus.OK).path("messageId")
                .asText()).isEqualTo(id);
        Map<String, Object> pending = request("R-3", "HBTEST0003", "Jane", "jane@example.com", "en-GB");
        pending.put("status", "PENDING_UNKNOWN");
        web.post().uri("/api/confirmations").bodyValue(pending).exchange().expectStatus().isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    @DisplayName("AQPI-25 8.2: transient provider failures are retried; permanent failures are visible to ops")
    void deliveryStates() {
        JsonNode flaky = confirm("R-4", "HBTEST0004", "Jane", "jane@flaky.test", "en-GB", HttpStatus.CREATED);
        assertThat(flaky.path("attempts").asInt()).isGreaterThanOrEqualTo(2);
        assertThat(flaky.path("status").asText()).isNotEqualTo("FAILED");

        JsonNode failed = confirm("R-5", "HBTEST0005", "Jane", "jane@fail.test", "en-GB", HttpStatus.CREATED);
        assertThat(failed.path("status").asText()).isEqualTo("FAILED");

        web.get().uri("/api/ops/messages").exchange().expectStatus().isForbidden();
        JsonNode masked = ops("SUPPORT");
        JsonNode full = ops("EMAIL_OPS");
        assertThat(masked.toString()).doesNotContain("jane@fail.test");
        assertThat(full.toString()).contains("jane@fail.test");
    }

    @Test
    @DisplayName("AQPI-26 8.3: resend gives the same answer whether or not the details match")
    void resendGeneric() {
        confirm("R-6", "HBTEST0006", "Jane", "jane@example.com", "en-GB", HttpStatus.CREATED);
        String ok = resend("HBTEST0006", "Doe");
        assertThat(resend("HBTEST0006", "Wrong")).isEqualTo(ok);
        assertThat(resend("HBNOTREAL1", "Doe")).isEqualTo(ok);
    }

    private JsonNode ops(String role) {
        return web.get().uri("/api/ops/messages").header("X-Operator-Role", role).exchange().expectStatus().isOk()
                .expectBody(JsonNode.class).returnResult().getResponseBody();
    }

    private String resend(String number, String lastName) {
        return web.post().uri("/api/confirmations/resend").header("X-Client-Id", "test-" + lastName)
                .bodyValue(Map.of("confirmationNumber", number, "lastName", lastName)).exchange()
                .expectStatus().isAccepted().expectBody(JsonNode.class).returnResult().getResponseBody()
                .path("message").asText();
    }

    private JsonNode confirm(String reservationId, String number, String firstName, String email, String locale,
            HttpStatus expected) {
        return web.post().uri("/api/confirmations").bodyValue(request(reservationId, number, firstName, email, locale))
                .exchange().expectStatus().isEqualTo(expected).expectBody(JsonNode.class).returnResult()
                .getResponseBody();
    }

    private static Map<String, Object> request(String reservationId, String number, String firstName, String email,
            String locale) {
        LocalDate in = LocalDate.now().plusDays(30);
        Map<String, Object> money = Map.of("amount", 500, "currency", "USD");
        Map<String, Object> r = new HashMap<>();
        r.put("reservationId", reservationId);
        r.put("confirmationNumber", number);
        r.put("status", "CONFIRMED");
        r.put("locale", locale);
        r.put("guestFirstName", firstName);
        r.put("guestLastName", "Doe");
        r.put("guestEmail", email);
        r.put("hotel", Map.of("name", "Harbor View Hotel", "address", "12 Pier Street", "city", "New York",
                "checkInFrom", "15:00", "checkOutUntil", "11:00"));
        r.put("checkIn", in);
        r.put("checkOut", in.plusDays(2));
        r.put("nights", 2);
        r.put("rooms", 1);
        r.put("adults", 2);
        r.put("children", 0);
        r.put("roomName", "Standard King");
        r.put("ratePlanName", "Flexible");
        r.put("items", List.of(Map.of("label", "Room", "quantity", 1, "amount", money)));
        r.put("total", money);
        r.put("paymentRule", "PAY_AT_HOTEL");
        r.put("cancellationTerms", "Free cancellation until 48 hours before check-in");
        return r;
    }
}
