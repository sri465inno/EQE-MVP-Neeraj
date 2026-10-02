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

/** Epic 6 (AQPI-23) stories 8.1-8.4. */
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

    @Test
    @DisplayName("AQPI-24 8.1 release 2.0: a refundable booking's confirmation states its free-cancellation deadline")
    void freeCancellationDeadline() {
        Map<String, Object> flex = request("R-7", "HBTEST0007", "Jane", "jane@example.com", "en-GB");
        flex.put("refundable", true);
        String deadline = LocalDate.now().plusDays(28) + " 00:00 UTC";
        JsonNode m = post("/api/confirmations", flex, HttpStatus.CREATED);
        assertThat(m.path("html").asText()).contains("Free cancellation until " + deadline + " (48 hours before check-in).");
        assertThat(m.path("text").asText()).contains(deadline);
        Map<String, Object> saver = request("R-8", "HBTEST0008", "Jane", "jane@example.com", "en-GB");
        saver.put("refundable", false);
        assertThat(post("/api/confirmations", saver, HttpStatus.CREATED).path("html").asText())
                .doesNotContain(" UTC (48 hours before check-in)");
    }

    @Test
    @DisplayName("AQPI-25 8.2 release 2.0: operations can retry a failed e-mail at most 3 times")
    void retryLimit() {
        String id = confirm("R-9", "HBTEST0009", "Jane", "jane@fail.test", "en-GB", HttpStatus.CREATED)
                .path("messageId").asText();
        for (int i = 0; i < 3; i++) {
            web.post().uri("/api/ops/messages/{id}/retry", id).exchange().expectStatus().isOk();
        }
        web.post().uri("/api/ops/messages/{id}/retry", id).exchange().expectStatus().isEqualTo(HttpStatus.CONFLICT)
                .expectBody().jsonPath("$.code").isEqualTo("RETRY_LIMIT_REACHED");
    }

    @Test
    @DisplayName("AQPI-37 8.4: one cancellation e-mail per cancelled reservation; only cancelled reservations get one")
    void cancellationEmail() {
        Map<String, Object> cancelled = request("R-10", "HBTEST0010", "Jane", "jane@example.com", "en-GB");
        cancelled.put("status", "CANCELLED");
        JsonNode first = post("/api/cancellations", cancelled, HttpStatus.CREATED);
        assertThat(first.path("kind").asText()).isEqualTo("CANCELLATION");
        assertThat(first.path("subject").asText()).isEqualTo("Your booking is cancelled - HBTEST0010");
        assertThat(first.path("html").asText()).contains("lang=\"en-GB\"", "cancelled free of charge");
        assertThat(first.path("recipient").asText()).isEqualTo("j***@e***.com");
        assertThat(post("/api/cancellations", cancelled, HttpStatus.OK).path("messageId").asText())
                .isEqualTo(first.path("messageId").asText());
        post("/api/cancellations", request("R-11", "HBTEST0011", "Jane", "jane@example.com", "en-GB"), HttpStatus.CONFLICT);
    }

    private JsonNode post(String uri, Map<String, Object> body, HttpStatus expected) {
        return web.post().uri(uri).bodyValue(body).exchange().expectStatus().isEqualTo(expected)
                .expectBody(JsonNode.class).returnResult().getResponseBody();
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
