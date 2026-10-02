package com.hotelbooking.common.events;

import java.time.Instant;
import java.util.Map;

/**
 * Versioned business event (story 9.2, AQPI-29). Business events go to the {@code business-events} logger;
 * technical logs use the service's own loggers, so the two are distinguishable.
 */
public record BusinessEvent(String name, int schemaVersion, Instant timestamp, String environment, String service,
        String correlationId, String outcome, String errorCategory, Long durationMs, Map<String, Object> attributes) {

    public static final String KIND = "business";

    public String kind() {
        return KIND;
    }
}
