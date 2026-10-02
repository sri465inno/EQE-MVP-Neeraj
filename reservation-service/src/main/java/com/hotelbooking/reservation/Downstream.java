package com.hotelbooking.reservation;

import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import com.hotelbooking.common.PlatformAutoConfiguration;
import com.hotelbooking.common.resilience.DependencyCalls;
import com.hotelbooking.common.resilience.PlatformProperties;
import com.hotelbooking.common.web.DownstreamErrors;
import com.hotelbooking.reservation.ReservationApi.CartSnapshot;
import com.hotelbooking.reservation.ReservationApi.CommitmentRequest;
import com.hotelbooking.reservation.ReservationApi.CompleteRequest;
import com.hotelbooking.reservation.ReservationApi.ConfirmationRequest;
import com.hotelbooking.reservation.ReservationApi.MessageStatus;

import reactor.core.publisher.Mono;

/** Cart checkout, inventory commitment and confirmation requests. All are safe to retry by design. */
@Component
public class Downstream {

    public static final String CART = "cart-service";
    public static final String HOTEL = "hotel-service";
    public static final String NOTIFICATION = "notification-service";

    private final WebClient cart;
    private final WebClient hotel;
    private final WebClient notification;
    private final DependencyCalls calls;

    public Downstream(WebClient.Builder builder, PlatformProperties properties, DependencyCalls calls) {
        this.cart = PlatformAutoConfiguration.client(builder, properties, CART);
        this.hotel = PlatformAutoConfiguration.client(builder, properties, HOTEL);
        this.notification = PlatformAutoConfiguration.client(builder, properties, NOTIFICATION);
        this.calls = calls;
    }

    public Mono<CartSnapshot> checkout(String cartId) {
        return calls.call(CART, true, cart.post().uri("/api/carts/{id}/checkout", cartId).retrieve()
                .bodyToMono(CartSnapshot.class)).onErrorMap(DownstreamErrors::translate);
    }

    public Mono<Void> completeCart(String cartId, String reservationId) {
        return calls.call(CART, true, cart.post().uri("/api/carts/{id}/complete", cartId)
                .bodyValue(new CompleteRequest(reservationId)).retrieve().bodyToMono(Void.class))
                .onErrorMap(DownstreamErrors::translate);
    }

    public Mono<Void> commit(CommitmentRequest request) {
        return calls.call(HOTEL, true, hotel.post().uri("/api/inventory/commitments").bodyValue(request).retrieve()
                .bodyToMono(Void.class)).onErrorMap(DownstreamErrors::translate);
    }

    public Mono<Void> release(String reference) {
        return calls.call(HOTEL, true, hotel.delete().uri("/api/inventory/commitments/{ref}", reference).retrieve()
                .bodyToMono(Void.class)).onErrorMap(DownstreamErrors::translate);
    }

    public Mono<MessageStatus> requestConfirmation(ConfirmationRequest request) {
        return calls.call(NOTIFICATION, true, notification.post().uri("/api/confirmations").bodyValue(request)
                .retrieve().bodyToMono(MessageStatus.class)).onErrorMap(DownstreamErrors::translate);
    }

    public Mono<MessageStatus> requestCancellationEmail(ConfirmationRequest request) {
        return calls.call(NOTIFICATION, true, notification.post().uri("/api/cancellations").bodyValue(request)
                .retrieve().bodyToMono(MessageStatus.class)).onErrorMap(DownstreamErrors::translate);
    }
}
