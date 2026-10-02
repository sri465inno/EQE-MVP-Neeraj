package com.hotelbooking.common.web;

import org.springframework.web.reactive.function.client.ClientRequest;
import org.springframework.web.reactive.function.client.ExchangeFilterFunction;

import reactor.core.publisher.Mono;

/** Forwards the caller's correlation ID on every outbound WebClient call. */
public final class CorrelationPropagation {

    private CorrelationPropagation() {
    }

    public static ExchangeFilterFunction filter() {
        return (request, next) -> Mono.deferContextual(ctx -> next.exchange(
                ClientRequest.from(request).header(CorrelationId.HEADER, CorrelationId.from(ctx)).build()));
    }
}
