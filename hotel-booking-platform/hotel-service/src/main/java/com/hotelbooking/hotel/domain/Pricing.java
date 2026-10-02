package com.hotelbooking.hotel.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

import com.hotelbooking.common.money.Money;
import com.hotelbooking.common.privacy.Masking;

/** Stay pricing: weekend nights (Fri, Sat) +15 %, tax on room charge, mandatory fee per room-night. */
public final class Pricing {

    public static final BigDecimal WEEKEND_UPLIFT = new BigDecimal("1.15");

    public record Breakdown(Money roomCharge, Money taxes, Money mandatoryFees, Money total, Money averageNightly,
            long nights, String priceVersion) {
    }

    private Pricing() {
    }

    public static Breakdown price(Hotel hotel, RatePlan plan, LocalDate checkIn, LocalDate checkOut, int rooms) {
        long nights = ChronoUnit.DAYS.between(checkIn, checkOut);
        Money room = Money.zero(hotel.currency());
        for (LocalDate night = checkIn; night.isBefore(checkOut); night = night.plusDays(1)) {
            BigDecimal nightly = weekend(night) ? plan.nightly().multiply(WEEKEND_UPLIFT) : plan.nightly();
            room = room.plus(new Money(nightly, hotel.currency()).times(rooms));
        }
        Money taxes = room.percent(hotel.taxRatePercent());
        Money fees = new Money(hotel.mandatoryFeePerRoomNight(), hotel.currency()).times(nights * rooms);
        Money total = room.plus(taxes).plus(fees);
        Money average = new Money(room.amount().divide(BigDecimal.valueOf(Math.max(1, nights * rooms)), 2,
                RoundingMode.HALF_UP), hotel.currency());
        String version = Masking.fingerprint(hotel.id(), plan.code(), checkIn.toString(), checkOut.toString(),
                String.valueOf(rooms), total.amount().toPlainString()).substring(0, 16);
        return new Breakdown(room, taxes, fees, total, average, nights, version);
    }

    private static boolean weekend(LocalDate night) {
        return night.getDayOfWeek() == DayOfWeek.FRIDAY || night.getDayOfWeek() == DayOfWeek.SATURDAY;
    }
}
