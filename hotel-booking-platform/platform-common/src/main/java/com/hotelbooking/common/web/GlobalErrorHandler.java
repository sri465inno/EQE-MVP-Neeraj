package com.hotelbooking.common.web;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.support.WebExchangeBindException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.ServerWebInputException;

import com.hotelbooking.common.resilience.DependencyUnavailableException;

/** Maps every failure to {@link ApiError}; never echoes request payloads (story 9.1). */
@RestControllerAdvice
public class GlobalErrorHandler {

    private static final Logger LOG = LoggerFactory.getLogger(GlobalErrorHandler.class);

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiError> api(ApiException e, ServerWebExchange exchange) {
        return body(e.status(), e.code(), e.getMessage(), e.retryable(), e.fieldIssues(), exchange);
    }

    @ExceptionHandler(WebExchangeBindException.class)
    ResponseEntity<ApiError> validation(WebExchangeBindException e, ServerWebExchange exchange) {
        List<FieldIssue> issues = e.getFieldErrors().stream()
                .map(f -> new FieldIssue(f.getField(), "field." + f.getCode(), f.getDefaultMessage()))
                .toList();
        return body(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Some details need correcting before we can continue.",
                false, issues, exchange);
    }

    @ExceptionHandler(ServerWebInputException.class)
    ResponseEntity<ApiError> input(ServerWebInputException e, ServerWebExchange exchange) {
        return body(HttpStatus.BAD_REQUEST, "INVALID_REQUEST",
                "We couldn't read that request. Check the details and try again.", false, List.of(), exchange);
    }

    @ExceptionHandler(DependencyUnavailableException.class)
    ResponseEntity<ApiError> dependency(DependencyUnavailableException e, ServerWebExchange exchange) {
        LOG.warn("dependency={} category={} correlationId={}", e.dependency(), e.category(),
                exchange.getAttribute(CorrelationId.CONTEXT_KEY));
        return body(HttpStatus.SERVICE_UNAVAILABLE, "SERVICE_TEMPORARILY_UNAVAILABLE",
                "Something went wrong on our side. Please try again in a moment.", true, List.of(), exchange);
    }

    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<ApiError> status(ResponseStatusException e, ServerWebExchange exchange) {
        HttpStatus status = HttpStatus.valueOf(e.getStatusCode().value());
        return body(status, status.name(), e.getReason() == null ? status.getReasonPhrase() : e.getReason(), false,
                List.of(), exchange);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> unexpected(Exception e, ServerWebExchange exchange) {
        LOG.error("unexpected error type={} correlationId={}", e.getClass().getSimpleName(),
                exchange.getAttribute(CorrelationId.CONTEXT_KEY));
        return body(HttpStatus.INTERNAL_SERVER_ERROR, "UNEXPECTED_ERROR",
                "Something went wrong on our side. Please try again in a moment.", true, List.of(), exchange);
    }

    private static ResponseEntity<ApiError> body(HttpStatus status, String code, String message, boolean retryable,
            List<FieldIssue> issues, ServerWebExchange exchange) {
        String id = exchange.getAttribute(CorrelationId.CONTEXT_KEY);
        return ResponseEntity.status(status).body(new ApiError(status.value(), code, message, id, retryable, issues));
    }
}
