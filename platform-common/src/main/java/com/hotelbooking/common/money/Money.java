package com.hotelbooking.common.money;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Objects;

/** Amount and ISO currency; arithmetic refuses to mix currencies (story 6.3: currency shown consistently). */
public record Money(BigDecimal amount, String currency) {

    public Money {
        Objects.requireNonNull(amount, "amount");
        Objects.requireNonNull(currency, "currency");
        amount = amount.setScale(2, RoundingMode.HALF_UP);
    }

    public static Money of(String amount, String currency) {
        return new Money(new BigDecimal(amount), currency);
    }

    public static Money zero(String currency) {
        return new Money(BigDecimal.ZERO, currency);
    }

    public Money plus(Money other) {
        requireSameCurrency(other);
        return new Money(amount.add(other.amount), currency);
    }

    public Money minus(Money other) {
        requireSameCurrency(other);
        return new Money(amount.subtract(other.amount), currency);
    }

    public Money times(long quantity) {
        return new Money(amount.multiply(BigDecimal.valueOf(quantity)), currency);
    }

    public Money percent(BigDecimal rate) {
        return new Money(amount.multiply(rate).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP), currency);
    }

    private void requireSameCurrency(Money other) {
        if (!currency.equals(other.currency)) {
            throw new IllegalArgumentException("Currency mismatch: " + currency + " vs " + other.currency);
        }
    }
}
