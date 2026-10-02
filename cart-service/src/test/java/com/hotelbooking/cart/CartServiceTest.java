package com.hotelbooking.cart;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelbooking.cart.CartApi.CartView;
import com.hotelbooking.cart.CartApi.CreateCartRequest;
import com.hotelbooking.cart.CartApi.OfferItemValidation;
import com.hotelbooking.cart.CartApi.Quote;
import com.hotelbooking.common.events.EventPublisher;
import com.hotelbooking.common.money.Money;
import com.hotelbooking.common.resilience.DependencyUnavailableException;
import com.hotelbooking.common.web.ApiException;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import reactor.core.publisher.Mono;

/** Epic 4 (AQPI-14) stories 6.1-6.3 with hotel and offer dependencies stubbed. */
class CartServiceTest {

    private static final LocalDate IN = LocalDate.now().plusDays(30);

    private final MutableClock clock = new MutableClock(Instant.parse("2026-10-01T10:00:00Z"));
    private Downstream downstream;
    private CartService service;

    @BeforeEach
    void setUp() {
        downstream = mock(Downstream.class);
        EventPublisher events = new EventPublisher(new ObjectMapper().findAndRegisterModules(), new SimpleMeterRegistry(),
                clock, "test", "cart-service");
        service = new CartService(downstream, new CartProperties(), events, clock);
        when(downstream.quote(anyString(), any())).thenReturn(Mono.just(quote("400.00", "v1", true)));
    }

    @Test
    @DisplayName("AQPI-15 6.1: a cart itemises room, taxes, fees and extras and expires after 20 minutes (AQPI-33)")
    void cartTotalsAndExpiry() {
        when(downstream.validateOffers(any(), any())).thenReturn(Mono.just(List.of(breakfast(true))));
        CartView cart = create();
        assertThat(Duration.between(cart.createdAt(), cart.expiresAt())).isEqualTo(Duration.ofMinutes(20));
        assertThat(cart.totals().total().amount()).isEqualByComparingTo("500.00");

        CartView withExtra = service.addAncillary(cart.cartId(), "BREAKFAST", 1).block();
        assertThat(withExtra.totals().optionalExtras().amount()).isEqualByComparingTo("30.00");
        assertThat(withExtra.totals().total().amount()).isEqualByComparingTo("530.00");
        CartView removed = service.removeAncillary(cart.cartId(), "BREAKFAST").block();
        assertThat(removed.totals().total().amount()).isEqualByComparingTo("500.00");

        clock.advance(Duration.ofMinutes(21));
        assertThatThrownBy(() -> service.addAncillary(cart.cartId(), "BREAKFAST", 1).block())
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(HttpStatus.GONE));
    }

    @Test
    @DisplayName("AQPI-15 6.1 AC4: a room that is no longer available cannot be added")
    void unavailableRoom() {
        when(downstream.quote(anyString(), any())).thenReturn(Mono.just(quote("400.00", "v1", false)));
        assertThatThrownBy(this::create).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.code()).isEqualTo("ROOM_NO_LONGER_AVAILABLE"));
    }

    @Test
    @DisplayName("AQPI-16 AQPI-31: an offer-service outage blocks extras only; the room can still be checked out")
    void offerOutageIsolated() {
        when(downstream.validateOffers(any(), any())).thenReturn(Mono.error(new DependencyUnavailableException(
                "offer-service", DependencyUnavailableException.Category.UNAVAILABLE, new RuntimeException())));
        CartView cart = create();
        assertThatThrownBy(() -> service.addAncillary(cart.cartId(), "BREAKFAST", 1).block())
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.code()).isEqualTo("EXTRAS_UNAVAILABLE");
                    assertThat(e.retryable()).isTrue();
                });
        assertThat(service.checkout(cart.cartId()).block().totals().total().amount()).isEqualByComparingTo("500.00");
    }

    @Test
    @DisplayName("AQPI-17 6.3: a material price change must be acknowledged before checkout")
    void materialChange() {
        CartView cart = create();
        when(downstream.quote(anyString(), any())).thenReturn(Mono.just(quote("480.00", "v2", true)));
        CartView revalidated = service.revalidate(cart.cartId()).block();
        assertThat(revalidated.requiresAcknowledgement()).isTrue();
        assertThat(revalidated.pendingChange().difference().amount()).isPositive();
        assertThatThrownBy(() -> service.checkout(cart.cartId()).block()).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.code()).isEqualTo("PRICE_CHANGE_REQUIRES_ACKNOWLEDGEMENT"));
        assertThatThrownBy(() -> service.acknowledge(cart.cartId(), "old").block())
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("PRICE_VERSION_MISMATCH"));
        service.acknowledge(cart.cartId(), revalidated.priceVersion()).block();
        assertThat(service.checkout(cart.cartId()).block().requiresAcknowledgement()).isFalse();
    }

    @Test
    @DisplayName("AQPI-21: a completed cart cannot be booked again")
    void completedCart() {
        CartView cart = create();
        service.complete(cart.cartId(), "R-1").block();
        assertThatThrownBy(() -> service.checkout(cart.cartId()).block()).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.code()).isEqualTo("CART_ALREADY_CHECKED_OUT"));
        assertThatThrownBy(() -> service.complete(cart.cartId(), "R-2").block()).isInstanceOf(ApiException.class);
    }

    private CartView create() {
        return service.create(new CreateCartRequest("H-NYC-001", "STD-K", "FLEX", IN, IN.plusDays(2), 1, 2, 0, null,
                "S-1")).block();
    }

    private static OfferItemValidation breakfast(boolean available) {
        Money price = Money.of("30.00", "USD");
        return new OfferItemValidation("BREAKFAST", "Daily breakfast", true, available, 1, 2, true, price, "PER_STAY",
                price, null);
    }

    private static Quote quote(String roomCharge, String version, boolean available) {
        Money room = Money.of(roomCharge, "USD");
        Money taxes = Money.of("75.00", "USD");
        Money fees = Money.of("25.00", "USD");
        return new Quote("H-NYC-001", "Harbor View Hotel", "New York", "12 Pier Street", "15:00", "11:00", "NYC",
                List.of("wifi"), "STD-K", "Standard King", "FLEX", "Flexible", IN, IN.plusDays(2), 2, 1, 2, 0, "USD", room,
                taxes, fees, room.plus(taxes).plus(fees), "PAY_AT_HOTEL", true, "Free cancellation", "", 3, available,
                version, false, null);
    }

    static final class MutableClock extends Clock {
        private Instant now;

        MutableClock(Instant now) {
            this.now = now;
        }

        void advance(Duration by) {
            now = now.plus(by);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
