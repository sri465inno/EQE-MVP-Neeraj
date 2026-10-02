package com.hotelbooking.hotel.domain;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

/**
 * Deterministic seed catalogue used by the demo and the tests. Three destinations, each with an available,
 * a limited and (in NYC) a sold-out property.
 */
@Component
public class Catalog {

    private final Map<String, Hotel> hotels = new ConcurrentHashMap<>();

    public Catalog() {
        reset();
    }

    public final synchronized void reset() {
        hotels.clear();
        seed().forEach(h -> hotels.put(h.id(), h));
    }

    public Collection<Hotel> all() {
        return hotels.values();
    }

    public Optional<Hotel> find(String id) {
        return Optional.ofNullable(hotels.get(id));
    }

    public boolean knowsDestination(String destination) {
        return hotels.values().stream().anyMatch(h -> h.destination().equalsIgnoreCase(destination));
    }

    /** Demo control: change a nightly rate so price-change behaviour (stories 4.3, 6.1, 6.3) can be shown. */
    public synchronized Optional<RatePlan> setNightly(String hotelId, String roomCode, String rateCode, BigDecimal nightly) {
        Hotel hotel = hotels.get(hotelId);
        if (hotel == null || hotel.room(roomCode) == null) {
            return Optional.empty();
        }
        Map<String, Room> rooms = new LinkedHashMap<>();
        RatePlan[] changed = new RatePlan[1];
        for (Room room : hotel.rooms()) {
            if (!room.code().equals(roomCode)) {
                rooms.put(room.code(), room);
                continue;
            }
            List<RatePlan> plans = room.ratePlans().stream().map(p -> {
                if (!p.code().equals(rateCode)) {
                    return p;
                }
                changed[0] = p.withNightly(nightly);
                return changed[0];
            }).toList();
            rooms.put(room.code(), new Room(room.code(), room.name(), room.description(), room.maxAdults(),
                    room.maxChildren(), room.amenities(), plans));
        }
        if (changed[0] == null) {
            return Optional.empty();
        }
        hotels.put(hotelId, new Hotel(hotel.id(), hotel.name(), hotel.destination(), hotel.city(), hotel.address(),
                hotel.category(), hotel.distanceKm(), hotel.currency(), hotel.description(), hotel.images(),
                hotel.amenities(), hotel.taxRatePercent(), hotel.mandatoryFeePerRoomNight(), hotel.mandatoryFeeLabel(),
                hotel.policies(), List.copyOf(rooms.values())));
        return Optional.of(changed[0]);
    }

    private static List<Hotel> seed() {
        Hotel.Policies city = new Hotel.Policies("15:00", "11:00", "Pets not allowed", "Non-smoking property", "18");
        Hotel.Policies resort = new Hotel.Policies("16:00", "12:00", "Pets up to 10 kg allowed", "Non-smoking property", "21");
        return List.of(
                hotel("H-NYC-001", "Harbor View Hotel", "NYC", "New York", "12 Pier Street", 4, 1.2, "USD", "18.875", "25.00", city,
                        List.of("wifi", "gym", "restaurant", "parking"), "195.00"),
                hotel("H-NYC-002", "Midtown Budget Inn", "NYC", "New York", "400 W 40th Street", 2, 0.6, "USD", "18.875", "0.00", city,
                        List.of("wifi"), "119.00"),
                hotel("H-NYC-003", "Central Park Grand", "NYC", "New York", "1 Park Avenue", 5, 2.4, "USD", "18.875", "35.00", city,
                        List.of("wifi", "gym", "spa", "pool", "restaurant"), "420.00"),
                hotel("H-NYC-004", "Brooklyn Loft Suites", "NYC", "New York", "88 Kent Avenue", 3, 6.8, "USD", "18.875", "15.00", city,
                        List.of("wifi", "kitchen", "parking"), "165.00"),
                hotel("H-LON-001", "Thames Riverside Hotel", "LON", "London", "5 Embankment", 4, 0.9, "GBP", "20.00", "0.00", city,
                        List.of("wifi", "restaurant", "gym"), "210.00"),
                hotel("H-LON-002", "Camden Courtyard", "LON", "London", "22 Camden High Street", 3, 4.1, "GBP", "20.00", "0.00", city,
                        List.of("wifi", "parking"), "140.00"),
                hotel("H-PAR-001", "Hotel Lumiere", "PAR", "Paris", "9 Rue de Rivoli", 4, 0.5, "EUR", "10.00", "3.50", resort,
                        List.of("wifi", "restaurant", "spa"), "230.00"),
                hotel("H-PAR-002", "Montmartre Maison", "PAR", "Paris", "41 Rue Lepic", 3, 3.2, "EUR", "10.00", "2.00", city,
                        List.of("wifi"), "150.00"));
    }

    private static Hotel hotel(String id, String name, String destination, String city, String address, int category,
            double distanceKm, String currency, String taxRate, String fee, Hotel.Policies policies, List<String> amenities,
            String baseNightly) {
        BigDecimal base = new BigDecimal(baseNightly);
        String terms = "Free cancellation until 48 hours before check-in; after that the first night is charged.";
        List<RatePlan> standardPlans = List.of(
                new RatePlan("FLEX", "Flexible – pay at hotel", base, true, false, PaymentRule.PAY_AT_HOTEL, terms,
                        "Card guarantee required"),
                new RatePlan("SAVER", "Advance saver – pay now", base.multiply(new BigDecimal("0.85")), false, false,
                        PaymentRule.PAY_NOW, "Non-refundable. Changes are not permitted.", "Full prepayment at booking"),
                new RatePlan("BB", "Bed and breakfast", base.add(new BigDecimal("30")), true, true, PaymentRule.PAY_AT_HOTEL,
                        terms, "Breakfast for registered guests only"));
        List<RatePlan> suitePlans = standardPlans.stream()
                .map(p -> p.withNightly(p.nightly().multiply(new BigDecimal("1.6")))).toList();
        List<Room> rooms = List.of(
                new Room("STD-K", "Standard King", "One king bed, city view, 25 m²", 2, 1, List.of("wifi", "tv", "desk"), standardPlans),
                new Room("STD-TT", "Standard Twin", "Two twin beds, 24 m²", 2, 2, List.of("wifi", "tv"), standardPlans),
                new Room("STE-F", "Family Suite", "Separate living room, sleeps 4, 45 m²", 4, 3, List.of("wifi", "tv", "sofa-bed", "minibar"),
                        suitePlans));
        return new Hotel(id, name, destination, city, address, category, distanceKm, currency,
                name + " in " + city + ", " + category + "-star, " + distanceKm + " km from the centre.",
                List.of("https://img.example.test/" + id + "/exterior.jpg", "https://img.example.test/" + id + "/room.jpg"),
                amenities, new BigDecimal(taxRate), new BigDecimal(fee),
                new BigDecimal(fee).signum() == 0 ? null : "Destination fee per room per night", policies, rooms);
    }
}
