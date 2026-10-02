package com.hotelbooking.hotel.api;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.hotelbooking.common.money.Money;
import com.hotelbooking.common.web.ApiException;
import com.hotelbooking.hotel.api.HotelApi.Availability;
import com.hotelbooking.hotel.api.HotelApi.AvailabilityPage;
import com.hotelbooking.hotel.api.HotelApi.AppliedFilter;
import com.hotelbooking.hotel.api.HotelApi.HotelDetail;
import com.hotelbooking.hotel.api.HotelApi.HotelSummary;
import com.hotelbooking.hotel.api.HotelApi.Quote;
import com.hotelbooking.hotel.api.HotelApi.QuoteRequest;
import com.hotelbooking.hotel.api.HotelApi.RatePlanOption;
import com.hotelbooking.hotel.api.HotelApi.RoomOption;
import com.hotelbooking.hotel.api.HotelApi.Sort;
import com.hotelbooking.hotel.domain.Catalog;
import com.hotelbooking.hotel.domain.Hotel;
import com.hotelbooking.hotel.domain.Inventory;
import com.hotelbooking.hotel.domain.Pricing;
import com.hotelbooking.hotel.domain.RatePlan;
import com.hotelbooking.hotel.domain.Room;

/** Read side of hotel-service: availability lists, details and quotes. */
@Service
public class HotelQueries {

    public static final int LIMITED_THRESHOLD = 2;
    public static final int MAX_PAGE_SIZE = 50;

    public record Stay(String destination, LocalDate checkIn, LocalDate checkOut, int rooms, int adults, int children) {
    }

    public record Filters(BigDecimal minPrice, BigDecimal maxPrice, List<String> amenities,
            Integer minCategory, Double maxDistanceKm) {

        boolean any() {
            return minPrice != null || maxPrice != null || !amenities.isEmpty() || minCategory != null || maxDistanceKm != null;
        }
    }

    private final Catalog catalog;
    private final Inventory inventory;

    public HotelQueries(Catalog catalog, Inventory inventory) {
        this.catalog = catalog;
        this.inventory = inventory;
    }

    public AvailabilityPage availability(Stay stay, Filters filters, Sort sort, int page, int size) {
        requireStay(stay.checkIn(), stay.checkOut(), stay.rooms());
        int pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, size));
        List<HotelSummary> all = catalog.all().stream()
                .filter(h -> h.destination().equalsIgnoreCase(stay.destination()))
                .map(h -> summary(h, stay))
                .toList();
        List<HotelSummary> filtered = all.stream().filter(s -> matches(s, filters)).sorted(order(sort)).toList();
        int from = Math.min(filtered.size(), Math.max(0, page) * pageSize);
        int to = Math.min(filtered.size(), from + pageSize);
        Set<String> amenities = new TreeSet<>();
        all.forEach(s -> amenities.addAll(s.amenities()));
        return new AvailabilityPage(stay.destination().toUpperCase(Locale.ROOT), stay.checkIn(), stay.checkOut(),
                stay.rooms(), stay.adults(), stay.children(), filtered.subList(from, to), Math.max(0, page), pageSize,
                filtered.size(), (filtered.size() + pageSize - 1) / pageSize, all.size(), sort, List.of(Sort.values()),
                applied(filters), filters.any(), List.copyOf(amenities));
    }

    public HotelDetail detail(String hotelId, Stay stay) {
        Hotel hotel = hotel(hotelId);
        requireStay(stay.checkIn(), stay.checkOut(), stay.rooms());
        List<RoomOption> rooms = hotel.rooms().stream().map(room -> {
            int left = inventory.available(hotel.id(), room.code(), stay.checkIn(), stay.checkOut());
            boolean fits = room.fits(stay.rooms(), stay.adults(), stay.children());
            List<RatePlanOption> plans = room.ratePlans().stream().map(plan -> {
                Pricing.Breakdown p = Pricing.price(hotel, plan, stay.checkIn(), stay.checkOut(), stay.rooms());
                return new RatePlanOption(plan.code(), plan.name(), plan.refundable(), plan.breakfastIncluded(),
                        plan.paymentRule(), plan.cancellationTerms(), plan.restrictions(), p.averageNightly(),
                        p.roomCharge(), p.taxes(), p.mandatoryFees(), p.total(), p.priceVersion());
            }).toList();
            return new RoomOption(room.code(), room.name(), room.description(), room.maxAdults(), room.maxChildren(),
                    room.amenities(), left, fits, fits && left >= stay.rooms(), plans);
        }).toList();
        return new HotelDetail(hotel.id(), hotel.name(), hotel.city(), hotel.address(), hotel.distanceKm(),
                hotel.category(), hotel.description(), hotel.images(), hotel.amenities(), hotel.policies(),
                feeDisclosure(hotel), hotel.currency(), rooms);
    }

    public Quote quote(String hotelId, QuoteRequest request) {
        Hotel hotel = hotel(hotelId);
        requireStay(request.checkIn(), request.checkOut(), request.rooms());
        Room room = Optional.ofNullable(hotel.room(request.roomCode())).orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "ROOM_NOT_FOUND", "That room type is not offered by this hotel."));
        RatePlan plan = room.ratePlans().stream().filter(p -> p.code().equals(request.ratePlanCode())).findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "RATE_PLAN_NOT_FOUND",
                        "That rate plan is not offered for this room."));
        if (!room.fits(request.rooms(), request.adults(), request.children())) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "ROOM_OCCUPANCY_EXCEEDED",
                    room.name() + " sleeps up to " + room.maxAdults() + " adults and " + room.maxChildren()
                            + " children per room. Choose another room or add rooms.");
        }
        int left = inventory.available(hotel.id(), room.code(), request.checkIn(), request.checkOut());
        Pricing.Breakdown p = Pricing.price(hotel, plan, request.checkIn(), request.checkOut(), request.rooms());
        boolean available = left >= request.rooms();
        boolean changed = request.expectedPriceVersion() != null && !request.expectedPriceVersion().equals(p.priceVersion());
        String notice = !available ? "This room is no longer available for your dates. Please choose another room or rate."
                : changed ? "The price for this selection has changed since you last saw it. Please review the new total."
                        : null;
        return new Quote(hotel.id(), hotel.name(), hotel.city(), hotel.address(), hotel.policies().checkInFrom(),
                hotel.policies().checkOutUntil(), hotel.destination(), hotel.amenities(), room.code(), room.name(), plan.code(), plan.name(),
                request.checkIn(), request.checkOut(), p.nights(), request.rooms(), request.adults(), request.children(),
                hotel.currency(), p.roomCharge(), p.taxes(), p.mandatoryFees(), p.total(), plan.paymentRule(),
                plan.refundable(), plan.cancellationTerms(), plan.restrictions(), left, available, p.priceVersion(),
                changed, notice);
    }

    private Hotel hotel(String id) {
        return catalog.find(id).orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "HOTEL_NOT_FOUND", "We could not find that hotel."));
    }

    private HotelSummary summary(Hotel hotel, Stay stay) {
        Money bestNightly = null;
        Money bestTotal = null;
        String bestPlan = null;
        String bestRoom = null;
        int maxLeft = 0;
        for (Room room : hotel.rooms()) {
            if (!room.fits(stay.rooms(), stay.adults(), stay.children())) {
                continue;
            }
            int left = inventory.available(hotel.id(), room.code(), stay.checkIn(), stay.checkOut());
            if (left < stay.rooms()) {
                continue;
            }
            maxLeft = Math.max(maxLeft, left);
            for (RatePlan plan : room.ratePlans()) {
                Pricing.Breakdown p = Pricing.price(hotel, plan, stay.checkIn(), stay.checkOut(), stay.rooms());
                if (bestNightly == null || p.averageNightly().amount().compareTo(bestNightly.amount()) < 0) {
                    bestNightly = p.averageNightly();
                    bestTotal = p.total();
                    bestPlan = plan.code();
                    bestRoom = room.code();
                }
            }
        }
        Availability availability = bestNightly == null ? Availability.SOLD_OUT
                : maxLeft <= LIMITED_THRESHOLD ? Availability.LIMITED : Availability.AVAILABLE;
        String qualification = bestNightly == null ? "Not available for your dates and party"
                : "From " + bestNightly.amount().toPlainString() + " " + hotel.currency()
                        + " per room per night before taxes (" + hotel.taxRatePercent().stripTrailingZeros().toPlainString()
                        + "%)" + (feeDisclosure(hotel) == null ? "" : "; " + feeDisclosure(hotel));
        return new HotelSummary(hotel.id(), hotel.name(), hotel.city(), hotel.address(), hotel.distanceKm(),
                hotel.category(), hotel.images().get(0), hotel.amenities(), bestNightly, bestTotal, hotel.currency(),
                availability, availability != Availability.SOLD_OUT, qualification, bestPlan, bestRoom);
    }

    private static String feeDisclosure(Hotel hotel) {
        return hotel.mandatoryFeeLabel() == null ? null
                : hotel.mandatoryFeeLabel() + ": " + hotel.mandatoryFeePerRoomNight().toPlainString() + " "
                        + hotel.currency() + ", payable on top of the room rate";
    }

    private static boolean matches(HotelSummary s, Filters f) {
        if (f.minPrice() != null && (s.startingNightly() == null || s.startingNightly().amount().compareTo(f.minPrice()) < 0)) {
            return false;
        }
        if (f.maxPrice() != null && (s.startingNightly() == null || s.startingNightly().amount().compareTo(f.maxPrice()) > 0)) {
            return false;
        }
        if (f.minCategory() != null && s.category() < f.minCategory()) {
            return false;
        }
        if (f.maxDistanceKm() != null && s.distanceKm() > f.maxDistanceKm()) {
            return false;
        }
        return s.amenities().containsAll(f.amenities());
    }

    private static Comparator<HotelSummary> order(Sort sort) {
        Comparator<HotelSummary> bookableFirst = Comparator.comparing(s -> !s.bookable());
        Comparator<HotelSummary> price = Comparator.comparing(
                s -> s.startingNightly() == null ? BigDecimal.valueOf(Long.MAX_VALUE) : s.startingNightly().amount());
        Comparator<HotelSummary> by = switch (sort) {
            case PRICE_ASC -> price;
            case PRICE_DESC -> price.reversed();
            case DISTANCE -> Comparator.comparingDouble(HotelSummary::distanceKm);
            case CATEGORY -> Comparator.comparingInt(HotelSummary::category).reversed();
            case RECOMMENDED -> Comparator.comparingInt(HotelSummary::category).reversed().thenComparing(price);
        };
        return bookableFirst.thenComparing(by).thenComparing(HotelSummary::hotelId);
    }

    private static List<AppliedFilter> applied(Filters f) {
        List<AppliedFilter> out = new ArrayList<>();
        if (f.minPrice() != null) {
            out.add(new AppliedFilter("minPrice", f.minPrice().toPlainString(), "Remove minPrice"));
        }
        if (f.maxPrice() != null) {
            out.add(new AppliedFilter("maxPrice", f.maxPrice().toPlainString(), "Remove maxPrice"));
        }
        f.amenities().forEach(a -> out.add(new AppliedFilter("amenity", a, "Remove amenity " + a)));
        if (f.minCategory() != null) {
            out.add(new AppliedFilter("minCategory", String.valueOf(f.minCategory()), "Remove minCategory"));
        }
        if (f.maxDistanceKm() != null) {
            out.add(new AppliedFilter("maxDistanceKm", String.valueOf(f.maxDistanceKm()), "Remove maxDistanceKm"));
        }
        return out;
    }

    static void requireStay(LocalDate checkIn, LocalDate checkOut, int rooms) {
        if (checkIn == null || checkOut == null || !checkOut.isAfter(checkIn) || rooms < 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_STAY",
                    "Check-out must be after check-in and at least one room is required.");
        }
    }
}
