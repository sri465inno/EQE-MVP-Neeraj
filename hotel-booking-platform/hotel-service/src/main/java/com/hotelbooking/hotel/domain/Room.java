package com.hotelbooking.hotel.domain;

import java.util.List;

public record Room(String code, String name, String description, int maxAdults, int maxChildren, List<String> amenities,
        List<RatePlan> ratePlans) {

    public boolean fits(int rooms, int adults, int children) {
        return ceilDiv(adults, rooms) <= maxAdults && ceilDiv(children, rooms) <= maxChildren;
    }

    private static int ceilDiv(int value, int by) {
        return (value + by - 1) / by;
    }
}
