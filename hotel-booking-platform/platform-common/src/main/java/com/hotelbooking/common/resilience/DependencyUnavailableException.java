package com.hotelbooking.common.resilience;

/** A downstream service timed out, failed with 5xx, could not be reached, or its circuit is open. */
public class DependencyUnavailableException extends RuntimeException {

    public enum Category {
        TIMEOUT,
        UNAVAILABLE,
        CIRCUIT_OPEN
    }

    private final String dependency;
    private final Category category;

    public DependencyUnavailableException(String dependency, Category category, Throwable cause) {
        super(dependency + " " + category, cause);
        this.dependency = dependency;
        this.category = category;
    }

    public String dependency() {
        return dependency;
    }

    public Category category() {
        return category;
    }
}
