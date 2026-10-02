package com.hotelbooking.common;

import java.time.Clock;
import java.time.Duration;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.reactive.function.client.WebClientCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.web.reactive.function.client.WebClient;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelbooking.common.events.EventPublisher;
import com.hotelbooking.common.privacy.FieldCipher;
import com.hotelbooking.common.resilience.DependencyCalls;
import com.hotelbooking.common.resilience.PlatformProperties;
import com.hotelbooking.common.web.CorrelationIdWebFilter;
import com.hotelbooking.common.web.CorrelationPropagation;
import com.hotelbooking.common.web.GlobalErrorHandler;

import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.micrometer.core.instrument.MeterRegistry;

/** Wires the shared Epic 7 capabilities into every service. */
@AutoConfiguration
@EnableConfigurationProperties(PlatformProperties.class)
public class PlatformAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    CorrelationIdWebFilter correlationIdWebFilter() {
        return new CorrelationIdWebFilter();
    }

    @Bean
    GlobalErrorHandler globalErrorHandler() {
        return new GlobalErrorHandler();
    }

    @Bean
    WebClientCustomizer correlationPropagationCustomizer() {
        return builder -> builder.filter(CorrelationPropagation.filter());
    }

    @Bean
    EventPublisher eventPublisher(ObjectMapper mapper, MeterRegistry meters, Clock clock, PlatformProperties properties) {
        return new EventPublisher(mapper, meters, clock, properties.getEnvironment(), properties.getService());
    }

    @Bean
    @ConditionalOnMissingBean
    FieldCipher fieldCipher(PlatformProperties properties) {
        return new FieldCipher(properties.getDataKey());
    }

    @Bean
    @ConditionalOnMissingBean
    CircuitBreakerRegistry circuitBreakerRegistry() {
        return CircuitBreakerRegistry.of(CircuitBreakerConfig.custom()
                .recordException(DependencyCalls::transientFailure)
                .slidingWindowSize(20)
                .minimumNumberOfCalls(10)
                .failureRateThreshold(50)
                .waitDurationInOpenState(Duration.ofSeconds(10))
                .build());
    }

    @Bean
    DependencyCalls dependencyCalls(PlatformProperties properties, CircuitBreakerRegistry breakers, MeterRegistry meters) {
        return new DependencyCalls(properties, breakers, meters);
    }

    /** WebClient for a named dependency, using {@code platform.dependencies.<name>.base-url}. */
    public static WebClient client(WebClient.Builder builder, PlatformProperties properties, String dependency) {
        PlatformProperties.Policy policy = properties.getDependencies().get(dependency);
        if (policy == null || policy.getBaseUrl() == null) {
            throw new IllegalStateException("platform.dependencies." + dependency + ".base-url is not set");
        }
        return builder.clone().baseUrl(policy.getBaseUrl()).build();
    }
}
