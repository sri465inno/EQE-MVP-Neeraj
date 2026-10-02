package com.hotelbooking.hotel.domain;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

/**
 * Room inventory by hotel, room type and night. Only reservation-service commits inventory (a cart never does,
 * story 6.1 BR). Commitments are keyed by reservation reference so repeats and releases are idempotent (story 7.3).
 */
@Component
public class Inventory {

    public static final int DEFAULT_ROOMS = 8;

    public record Commitment(String reference, String hotelId, String roomCode, LocalDate checkIn, LocalDate checkOut, int rooms) {
    }

    private final Map<String, Integer> capacity = new ConcurrentHashMap<>();
    private final Map<String, Commitment> commitments = new ConcurrentHashMap<>();

    public Inventory() {
        reset();
    }

    public final synchronized void reset() {
        capacity.clear();
        commitments.clear();
        capacity.put(key("H-NYC-003", "*"), 0);
        capacity.put(key("H-NYC-002", "*"), 2);
        capacity.put(key("H-LON-002", "STE-F"), 0);
    }

    public synchronized void setCapacity(String hotelId, String roomCode, int rooms) {
        capacity.put(key(hotelId, roomCode == null ? "*" : roomCode), Math.max(0, rooms));
    }

    /** Fewest rooms left on any night of the stay. */
    public synchronized int available(String hotelId, String roomCode, LocalDate checkIn, LocalDate checkOut) {
        int base = capacity.getOrDefault(key(hotelId, roomCode),
                capacity.getOrDefault(key(hotelId, "*"), DEFAULT_ROOMS));
        int min = base;
        for (LocalDate night = checkIn; night.isBefore(checkOut); night = night.plusDays(1)) {
            LocalDate n = night;
            int used = commitments.values().stream()
                    .filter(c -> c.hotelId().equals(hotelId) && c.roomCode().equals(roomCode)
                            && !n.isBefore(c.checkIn()) && n.isBefore(c.checkOut()))
                    .mapToInt(Commitment::rooms).sum();
            min = Math.min(min, base - used);
        }
        return Math.max(0, min);
    }

    /** Returns empty when inventory is insufficient; repeating the same reference returns the original commitment. */
    public synchronized Optional<Commitment> commit(Commitment request) {
        Commitment existing = commitments.get(request.reference());
        if (existing != null) {
            return Optional.of(existing);
        }
        if (available(request.hotelId(), request.roomCode(), request.checkIn(), request.checkOut()) < request.rooms()) {
            return Optional.empty();
        }
        commitments.put(request.reference(), request);
        return Optional.of(request);
    }

    public synchronized boolean release(String reference) {
        return commitments.remove(reference) != null;
    }

    public List<Commitment> commitments() {
        return List.copyOf(commitments.values());
    }

    private static String key(String hotelId, String roomCode) {
        return hotelId + "|" + roomCode;
    }
}
