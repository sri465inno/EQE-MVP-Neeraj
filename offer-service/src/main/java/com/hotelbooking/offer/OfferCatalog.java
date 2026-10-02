package com.hotelbooking.offer;

import java.math.BigDecimal;
import java.time.Month;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

import com.hotelbooking.offer.OfferApi.Interest;
import com.hotelbooking.offer.OfferApi.PricingUnit;

/** Ancillary products and their eligibility rules (version {@code offer-rules-v3}). */
@Component
public class OfferCatalog {

    public record Product(String code, String name, String description, Interest category, PricingUnit unit,
            Map<String, BigDecimal> prices, int maxQuantity, int basePriority, Set<String> destinations,
            String requiredAmenity, boolean requiresChildren, int minNights, Set<String> excludedRatePlans,
            Set<Month> season, String applicability, String restrictions) {
    }

    private final List<Product> products = List.of(
            product("BREAKFAST", "Daily breakfast", "Buffet breakfast for every guest in the room", Interest.DINING,
                    PricingUnit.PER_NIGHT, "24", 4, 5, Set.of(), null, false, 1, Set.of("BB"), Set.of(),
                    "All guests in the booked room", "Not offered on rates that already include breakfast"),
            product("LATE_CHECKOUT", "Late check-out (2 pm)", "Keep your room until 2 pm on departure day",
                    Interest.BUSINESS, PricingUnit.PER_STAY, "35", 1, 4, Set.of(), null, false, 1, Set.of(), Set.of(),
                    "Departure day", "Subject to confirmation at check-in"),
            product("AIRPORT_TRANSFER", "Airport transfer", "Private one-way car from the airport", Interest.TRANSPORT,
                    PricingUnit.PER_STAY, "75", 2, 3, Set.of("NYC", "LON", "PAR"), null, false, 1, Set.of(), Set.of(),
                    "Arrival day, up to 3 passengers", "Book at least 24 hours before arrival"),
            product("PARKING", "On-site parking", "Secure parking space for one car", Interest.TRANSPORT,
                    PricingUnit.PER_NIGHT, "40", 2, 2, Set.of(), "parking", false, 1, Set.of(), Set.of(),
                    "Per car per night", "Vehicles up to 2 m high"),
            product("SPA_ACCESS", "Spa day pass", "Full-day spa and thermal suite access", Interest.WELLNESS,
                    PricingUnit.PER_STAY, "60", 4, 2, Set.of(), "spa", false, 1, Set.of(), Set.of(),
                    "Per adult", "Guests 18 and over"),
            product("KIDS_CLUB", "Kids club", "Supervised activities for children aged 4-12", Interest.FAMILY,
                    PricingUnit.PER_NIGHT, "30", 3, 2, Set.of(), null, true, 1, Set.of(), Set.of(),
                    "Per child per day", "Ages 4 to 12"),
            product("CITY_TOUR", "Guided city tour", "Three-hour walking tour with a local guide", Interest.SIGHTSEEING,
                    PricingUnit.PER_STAY, "45", 6, 2, Set.of("LON", "PAR"), null, false, 2, Set.of(), Set.of(),
                    "Per person", "Runs daily at 10 am"),
            product("ROMANCE", "Romance package", "Champagne, flowers and chocolates in the room", Interest.ROMANCE,
                    PricingUnit.PER_STAY, "95", 1, 1, Set.of(), null, false, 1, Set.of(), Set.of(),
                    "Once per stay", "Guests 21 and over"),
            product("WINTER_SKATING", "Ice-skating pass", "Seasonal rink entry near the hotel", Interest.FAMILY,
                    PricingUnit.PER_STAY, "25", 6, 2, Set.of("NYC"), null, false, 1, Set.of(),
                    Set.of(Month.NOVEMBER, Month.DECEMBER, Month.JANUARY, Month.FEBRUARY),
                    "Per person", "November to February only"));

    private final Map<String, Boolean> available = new ConcurrentHashMap<>();

    public List<Product> products() {
        return products;
    }

    public Optional<Product> find(String code) {
        return products.stream().filter(p -> p.code().equals(code)).findFirst();
    }

    public boolean isAvailable(String code) {
        return available.getOrDefault(code, true);
    }

    /** Demo control: mark a product sold out (stories 5.1 AC2, 6.2 AC4). */
    public void setAvailable(String code, boolean value) {
        available.put(code, value);
    }

    public void reset() {
        available.clear();
    }

    private static Product product(String code, String name, String description, Interest category, PricingUnit unit,
            String usd, int maxQuantity, int priority, Set<String> destinations, String amenity, boolean children,
            int minNights, Set<String> excludedRates, Set<Month> season, String applicability, String restrictions) {
        BigDecimal base = new BigDecimal(usd);
        Map<String, BigDecimal> prices = Map.of("USD", base, "GBP", base.multiply(new BigDecimal("0.80")),
                "EUR", base.multiply(new BigDecimal("0.92")));
        return new Product(code, name, description, category, unit, prices, maxQuantity, priority, destinations, amenity,
                children, minNights, excludedRates, season, applicability, restrictions);
    }
}
