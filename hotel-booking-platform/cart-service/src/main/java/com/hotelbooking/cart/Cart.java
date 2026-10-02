package com.hotelbooking.cart;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.hotelbooking.cart.CartApi.AncillaryLine;
import com.hotelbooking.cart.CartApi.PendingChange;
import com.hotelbooking.cart.CartApi.RoomSelection;
import com.hotelbooking.cart.CartApi.Status;

/** Mutable cart state; guarded by {@link CartService}. A cart never holds inventory (story 6.1 BR). */
final class Cart {

    final String id;
    final Instant createdAt;
    final Instant expiresAt;
    Status status = Status.ACTIVE;
    RoomSelection room;
    final Map<String, AncillaryLine> ancillaries = new LinkedHashMap<>();
    PendingChange pendingChange;
    final List<String> notices = new ArrayList<>();
    String reservationId;

    Cart(String id, Instant createdAt, Instant expiresAt, RoomSelection room) {
        this.id = id;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
        this.room = room;
    }
}
