package com.hotelbooking.common.web;

import org.springframework.core.Ordered;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;

import reactor.core.publisher.Mono;

/** Accepts or creates the correlation ID, returns it on the response and puts it in the Reactor context. */
public class CorrelationIdWebFilter implements WebFilter, Ordered {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String id = CorrelationId.sanitizeOrCreate(exchange.getRequest().getHeaders().getFirst(CorrelationId.HEADER));
        exchange.getAttributes().put(CorrelationId.CONTEXT_KEY, id);
        exchange.getResponse().getHeaders().set(CorrelationId.HEADER, id);
        return chain.filter(exchange).contextWrite(ctx -> ctx.put(CorrelationId.CONTEXT_KEY, id));
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }
}
