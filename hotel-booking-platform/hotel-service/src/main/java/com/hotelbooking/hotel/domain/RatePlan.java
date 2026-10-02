package com.hotelbooking.hotel.domain;

import java.math.BigDecimal;

public record RatePlan(String code, String name, BigDecimal nightly, boolean refundable, boolean breakfastIncluded,
        PaymentRule paymentRule, String cancellationTerms, String restrictions) {

    public RatePlan withNightly(BigDecimal value) {
        return new RatePlan(code, name, value, refundable, breakfastIncluded, paymentRule, cancellationTerms, restrictions);
    }
}
