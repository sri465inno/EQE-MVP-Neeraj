package com.hotelbooking.hotel.domain;

import java.math.BigDecimal;
import java.util.List;

public record Hotel(String id, String name, String destination, String city, String address, int category,
        double distanceKm, String currency, String description, List<String> images, List<String> amenities,
        BigDecimal taxRatePercent, BigDecimal mandatoryFeePerRoomNight, String mandatoryFeeLabel, Policies policies,
        List<Room> rooms) {

    public record Policies(String checkInFrom, String checkOutUntil, String pets, String smoking, String minimumAge) {
    }

    public Room room(String code) {
        return rooms.stream().filter(r -> r.code().equals(code)).findFirst().orElse(null);
    }
}
