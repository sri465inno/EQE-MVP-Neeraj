package com.hotelbooking.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelbooking.common.events.BusinessEvent;
import com.hotelbooking.common.events.EventNames;
import com.hotelbooking.common.events.EventPublisher;
import com.hotelbooking.common.money.Money;
import com.hotelbooking.common.privacy.FieldCipher;
import com.hotelbooking.common.privacy.Masking;
import com.hotelbooking.common.resilience.DependencyCalls;
import com.hotelbooking.common.resilience.DependencyUnavailableException;
import com.hotelbooking.common.resilience.PlatformProperties;
import com.hotelbooking.common.web.CorrelationId;

import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

/** Epic 7 (AQPI-27) shared behaviour: stories 9.1 (AQPI-28), 9.2 (AQPI-29) and 9.4 (AQPI-31). */
class PlatformCommonTest {

    @Test
    @DisplayName("AQPI-29 9.2 AC1: unsafe correlation IDs are replaced, safe ones kept")
    void correlationIdSanitised() {
        assertThat(CorrelationId.sanitizeOrCreate("abc-12345")).isEqualTo("abc-12345");
        assertThat(CorrelationId.sanitizeOrCreate("<script>")).hasSize(36);
        assertThat(CorrelationId.sanitizeOrCreate(null)).hasSize(36);
    }

    @Test
    @DisplayName("AQPI-28 9.1 AC2: e-mail and phone masked; card numbers and e-mails scrubbed from text")
    void masking() {
        assertThat(Masking.email("jane.doe@example.com")).isEqualTo("j***@e***.com");
        assertThat(Masking.phone("+44 7700 900123")).isEqualTo("***23");
        assertThat(Masking.scrub("call jane@example.com card 4111 1111 1111 1111"))
                .isEqualTo("call [email] card [card]").doesNotContain("4111");
        assertThat(Masking.looksLikeCard("4111-1111-1111-1111")).isTrue();
        assertThat(Masking.looksLikeCard("tok_visa_ok")).isFalse();
        assertThat(Masking.fingerprint(" Smith ")).isEqualTo(Masking.fingerprint("smith"));
    }

    @Test
    @DisplayName("AQPI-28 9.1 AC4: sensitive fields are encrypted with authenticated encryption")
    void fieldCipher() {
        FieldCipher cipher = new FieldCipher(null);
        String sealed = cipher.encrypt("jane@example.com");
        assertThat(sealed).doesNotContain("jane");
        assertThat(cipher.encrypt("jane@example.com")).isNotEqualTo(sealed);
        assertThat(cipher.decrypt(sealed)).isEqualTo("jane@example.com");
        char[] chars = sealed.toCharArray();
        chars[chars.length - 3] = chars[chars.length - 3] == 'A' ? 'B' : 'A';
        assertThatThrownBy(() -> cipher.decrypt(new String(chars))).isInstanceOf(RuntimeException.class);
    }

    @Test
    @DisplayName("Money arithmetic keeps currency and two-decimal precision")
    void money() {
        Money a = Money.of("10.10", "USD");
        assertThat(a.plus(Money.of("0.25", "USD")).amount()).isEqualByComparingTo("10.35");
        assertThat(a.times(3).amount()).isEqualByComparingTo("30.30");
        assertThat(a.percent(new BigDecimal("18.875")).amount()).isEqualByComparingTo("1.91");
        assertThatThrownBy(() -> a.plus(Money.of("1", "EUR"))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("AQPI-29 9.2 AC2/AC3: events are versioned, carry correlation ID and drop personal fields")
    void eventsScrubbed() {
        EventPublisher events = new EventPublisher(new ObjectMapper().findAndRegisterModules(), new SimpleMeterRegistry(),
                Clock.systemUTC(), "test", "unit");
        events.event(EventNames.CHECKOUT_FORM).attr("email", "jane@example.com").attr("lastName", "Doe")
                .attr("note", "card 4111 1111 1111 1111").attr("cartId", "C-1").publish()
                .contextWrite(ctx -> ctx.put(CorrelationId.CONTEXT_KEY, "corr-123456")).block();
        BusinessEvent e = events.recent().get(0);
        assertThat(e.schemaVersion()).isEqualTo(EventNames.SCHEMA_VERSION);
        assertThat(e.correlationId()).isEqualTo("corr-123456");
        assertThat(e.attributes()).containsEntry("cartId", "C-1").containsEntry("note", "card [card]")
                .doesNotContainKeys("email", "lastName");
    }

    @Test
    @DisplayName("AQPI-31 9.4 AC3: idempotent calls retry transient failures; non-idempotent calls never retry")
    void retries() {
        DependencyCalls calls = calls(Duration.ofSeconds(1), 2);
        AtomicInteger attempts = new AtomicInteger();
        Mono<String> flaky = Mono.defer(() -> attempts.incrementAndGet() < 3
                ? Mono.error(WebClientResponseException.create(503, "down", null, null, null))
                : Mono.just("ok"));
        StepVerifier.create(calls.call("dep", true, flaky)).expectNext("ok").verifyComplete();
        assertThat(attempts).hasValue(3);

        AtomicInteger writes = new AtomicInteger();
        Mono<String> failing = Mono.defer(() -> {
            writes.incrementAndGet();
            return Mono.error(WebClientResponseException.create(503, "down", null, null, null));
        });
        StepVerifier.create(calls.call("dep2", false, failing)).expectError(DependencyUnavailableException.class).verify();
        assertThat(writes).hasValue(1);
    }

    @Test
    @DisplayName("AQPI-31 9.4 AC3: a slow dependency times out as a categorised, retryable failure")
    void timeout() {
        DependencyCalls calls = calls(Duration.ofMillis(50), 0);
        StepVerifier.create(calls.call("slow", true, Mono.just("late").delayElement(Duration.ofMillis(500))))
                .expectErrorSatisfies(e -> assertThat(((DependencyUnavailableException) e).category())
                        .isEqualTo(DependencyUnavailableException.Category.TIMEOUT))
                .verify();
    }

    private static DependencyCalls calls(Duration timeout, int retries) {
        PlatformProperties properties = new PlatformProperties();
        for (String dep : new String[] {"dep", "dep2", "slow"}) {
            PlatformProperties.Policy policy = new PlatformProperties.Policy();
            policy.setTimeout(timeout);
            policy.setRetries(retries);
            policy.setBackoff(Duration.ofMillis(5));
            properties.getDependencies().put(dep, policy);
        }
        return new DependencyCalls(properties, CircuitBreakerRegistry.ofDefaults(), new SimpleMeterRegistry());
    }
}
