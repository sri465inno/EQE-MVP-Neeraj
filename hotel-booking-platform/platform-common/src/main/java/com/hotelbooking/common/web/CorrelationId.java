package com.hotelbooking.common.web;

import java.util.UUID;
import java.util.regex.Pattern;

import reactor.core.publisher.Mono;
import reactor.util.context.ContextView;

/** Correlation ID shared by every service in the booking journey (story 9.2, AQPI-29). */
public final class CorrelationId {

    public static final String HEADER = "X-Correlation-Id";
    public static final String CONTEXT_KEY = "correlationId";

    private static final Pattern SAFE = Pattern.compile("[A-Za-z0-9._-]{8,64}");

    private CorrelationId() {
    }

    public static String sanitizeOrCreate(String candidate) {
        return candidate != null && SAFE.matcher(candidate).matches() ? candidate : UUID.randomUUID().toString();
    }

    public static String from(ContextView context) {
        return context.getOrDefault(CONTEXT_KEY, "none");
    }

    public static Mono<String> current() {
        return Mono.deferContextual(ctx -> Mono.just(from(ctx)));
    }
}
