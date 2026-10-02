package com.hotelbooking.common.web;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.reactive.function.client.WebClientResponseException;

/** Turns a downstream 4xx {@link ApiError} into a local {@link ApiException} with the same code and message. */
public final class DownstreamErrors {

    private DownstreamErrors() {
    }

    public static Throwable translate(Throwable error) {
        if (error instanceof WebClientResponseException e && e.getStatusCode().is4xxClientError()) {
            ApiError body = null;
            try {
                body = e.getResponseBodyAs(ApiError.class);
            } catch (RuntimeException ignored) {
                // body is not an ApiError; fall back to the status alone
            }
            HttpStatus status = HttpStatus.valueOf(e.getStatusCode().value());
            return body == null ? new ApiException(status, status.name(), status.getReasonPhrase())
                    : new ApiException(status, body.code(), body.message(), body.retryable(),
                            body.fieldIssues() == null ? List.of() : body.fieldIssues());
        }
        return error;
    }
}
