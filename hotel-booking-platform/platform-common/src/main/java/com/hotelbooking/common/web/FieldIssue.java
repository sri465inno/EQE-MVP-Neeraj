package com.hotelbooking.common.web;

/** A field-level problem written for the guest, plus the rule that raised it (stories 3.1, 3.2, 7.1). */
public record FieldIssue(String field, String ruleId, String message) {
}
