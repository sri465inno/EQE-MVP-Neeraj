package com.hotelbooking.common.resilience;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.TimeoutException;

import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.reactor.circuitbreaker.operator.CircuitBreakerOperator;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;

/**
 * Timeout, retry and circuit breaker around every downstream call, with latency metrics (story 9.4, AQPI-31).
 * Only transient failures are retried, and only when the caller marks the call idempotent.
 */
public class DependencyCalls {

    private final Map<String, PlatformProperties.Policy> policies;
    private final PlatformProperties.Policy defaults;
    private final CircuitBreakerRegistry breakers;
    private final MeterRegistry meters;

    public DependencyCalls(PlatformProperties properties, CircuitBreakerRegistry breakers, MeterRegistry meters) {
        this.policies = properties.getDependencies();
        this.defaults = new PlatformProperties.Policy();
        this.breakers = breakers;
        this.meters = meters;
    }

    public <T> Mono<T> call(String dependency, boolean idempotent, Mono<T> call) {
        PlatformProperties.Policy policy = policies.getOrDefault(dependency, defaults);
        CircuitBreaker breaker = breakers.circuitBreaker(dependency);
        int retries = idempotent ? policy.getRetries() : 0;
        return Mono.defer(() -> {
            long start = System.nanoTime();
            return call
                    .timeout(policy.getTimeout())
                    .retryWhen(Retry.backoff(retries, policy.getBackoff()).filter(DependencyCalls::transientFailure)
                            .onRetryExhaustedThrow((spec, signal) -> signal.failure()))
                    .transformDeferred(CircuitBreakerOperator.of(breaker))
                    .doOnSuccess(v -> time(dependency, "success", start))
                    .doOnError(e -> time(dependency, "failure", start))
                    .onErrorMap(DependencyCalls::unavailable, e -> new DependencyUnavailableException(dependency, category(e), e));
        });
    }

    private void time(String dependency, String outcome, long start) {
        Timer.builder("booking.dependency.latency").tag("dependency", dependency).tag("outcome", outcome)
                .register(meters).record(Duration.ofNanos(System.nanoTime() - start));
    }

    public static boolean transientFailure(Throwable e) {
        return e instanceof TimeoutException || e instanceof WebClientRequestException
                || (e instanceof WebClientResponseException r && r.getStatusCode().is5xxServerError());
    }

    private static boolean unavailable(Throwable e) {
        return transientFailure(e) || e instanceof CallNotPermittedException;
    }

    private static DependencyUnavailableException.Category category(Throwable e) {
        if (e instanceof CallNotPermittedException) {
            return DependencyUnavailableException.Category.CIRCUIT_OPEN;
        }
        return e instanceof TimeoutException ? DependencyUnavailableException.Category.TIMEOUT
                : DependencyUnavailableException.Category.UNAVAILABLE;
    }
}
