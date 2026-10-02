package com.hotelbooking.common.web;

import java.util.List;

import org.springframework.http.HttpStatus;

/** Business error with a guest-facing message. */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final boolean retryable;
    private final List<FieldIssue> fieldIssues;

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, false, List.of());
    }

    public ApiException(HttpStatus status, String code, String message, boolean retryable, List<FieldIssue> fieldIssues) {
        super(message);
        this.status = status;
        this.code = code;
        this.retryable = retryable;
        this.fieldIssues = List.copyOf(fieldIssues);
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }

    public boolean retryable() {
        return retryable;
    }

    public List<FieldIssue> fieldIssues() {
        return fieldIssues;
    }
}
