package com.hotelbooking.common.events;

import java.time.Clock;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelbooking.common.privacy.Masking;
import com.hotelbooking.common.web.CorrelationId;

import io.micrometer.core.instrument.MeterRegistry;
import reactor.core.publisher.Mono;

/**
 * Publishes business events. Attribute keys that name personal or payment data are dropped and string values
 * are scrubbed, so events never carry prohibited payloads (stories 9.1, 9.2). A failure to log never fails the
 * caller (story 9.2 AC4).
 */
public class EventPublisher {

    private static final Logger EVENTS = LoggerFactory.getLogger("business-events");
    private static final Logger LOG = LoggerFactory.getLogger(EventPublisher.class);
    private static final Set<String> PROHIBITED_KEYS = Set.of("email", "firstname", "lastname", "name", "guestname",
            "phone", "cardnumber", "pan", "cvv", "cvc", "securitycode", "password", "secret", "paymenttoken",
            "address", "freetext", "interests", "preferences");
    private static final int RECENT_LIMIT = 500;

    private final ObjectMapper mapper;
    private final MeterRegistry meters;
    private final Clock clock;
    private final String environment;
    private final String service;
    private final Deque<BusinessEvent> recent = new ArrayDeque<>();

    public EventPublisher(ObjectMapper mapper, MeterRegistry meters, Clock clock, String environment, String service) {
        this.mapper = mapper;
        this.meters = meters;
        this.clock = clock;
        this.environment = environment;
        this.service = service;
    }

    public Builder event(String name) {
        return new Builder(name);
    }

    /** Recent events kept in memory for tests and the ops view. */
    public synchronized List<BusinessEvent> recent() {
        return List.copyOf(recent);
    }

    static boolean prohibited(String key) {
        return PROHIBITED_KEYS.contains(key.toLowerCase(Locale.ROOT).replace("_", "").replace("-", ""));
    }

    private void record(BusinessEvent event) {
        try {
            synchronized (this) {
                recent.addLast(event);
                while (recent.size() > RECENT_LIMIT) {
                    recent.removeFirst();
                }
            }
            meters.counter("booking.business.events", "event", event.name(), "outcome", event.outcome()).increment();
            EVENTS.info(mapper.writeValueAsString(event));
        } catch (RuntimeException | JsonProcessingException e) {
            LOG.warn("business event dropped name={} reason={}", event.name(), e.getClass().getSimpleName());
            meters.counter("booking.business.events.dropped", "event", event.name()).increment();
        }
    }

    public final class Builder {

        private final String name;
        private final Map<String, Object> attributes = new LinkedHashMap<>();
        private String outcome = "success";
        private String errorCategory;
        private Long durationMs;

        private Builder(String name) {
            this.name = name;
        }

        public Builder outcome(String value) {
            if (value != null) {
                this.outcome = value;
            }
            return this;
        }

        public Builder error(String category) {
            if (category != null) {
                this.outcome = "failure";
                this.errorCategory = category;
            }
            return this;
        }

        public Builder duration(long millis) {
            this.durationMs = millis;
            return this;
        }

        public Builder attr(String key, Object value) {
            if (value != null && !prohibited(key)) {
                attributes.put(key, value instanceof String s ? Masking.scrub(s) : value);
            }
            return this;
        }

        public Mono<Void> publish() {
            return Mono.deferContextual(ctx -> {
                record(new BusinessEvent(name, EventNames.SCHEMA_VERSION, clock.instant(), environment, service,
                        CorrelationId.from(ctx), outcome, errorCategory, durationMs, Map.copyOf(attributes)));
                return Mono.<Void>empty();
            }).onErrorResume(e -> Mono.empty());
        }
    }
}
