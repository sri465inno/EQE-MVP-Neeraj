package com.hotelbooking.common.web;

import java.util.List;

/**
 * Error body used by every service. {@code message} is plain language for the guest; {@code code} is for
 * clients and support; {@code retryable} tells the UI whether offering "Try again" is safe.
 */
public record ApiError(int status, String code, String message, String correlationId, boolean retryable,
        List<FieldIssue> fieldIssues) {
}
