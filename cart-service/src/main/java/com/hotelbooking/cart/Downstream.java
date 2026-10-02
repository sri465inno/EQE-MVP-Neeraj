package com.hotelbooking.cart;

import java.util.List;

import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import com.hotelbooking.cart.CartApi.OfferItem;
import com.hotelbooking.cart.CartApi.OfferItemValidation;
import com.hotelbooking.cart.CartApi.OfferValidationRequest;
import com.hotelbooking.cart.CartApi.OfferValidationResponse;
import com.hotelbooking.cart.CartApi.Quote;
import com.hotelbooking.cart.CartApi.QuoteRequest;
import com.hotelbooking.cart.CartApi.RoomSelection;
import com.hotelbooking.common.PlatformAutoConfiguration;
import com.hotelbooking.common.resilience.DependencyCalls;
import com.hotelbooking.common.resilience.PlatformProperties;
import com.hotelbooking.common.web.DownstreamErrors;

import reactor.core.publisher.Mono;

/** hotel-service quotes (critical) and offer-service validation (non-critical, story 9.4 AC4). */
@Component
public class Downstream {

    public static final String HOTEL = "hotel-service";
    public static final String OFFER = "offer-service";

    private final WebClient hotel;
    private final WebClient offer;
    private final DependencyCalls calls;

    public Downstream(WebClient.Builder builder, PlatformProperties properties, DependencyCalls calls) {
        this.hotel = PlatformAutoConfiguration.client(builder, properties, HOTEL);
        this.offer = PlatformAutoConfiguration.client(builder, properties, OFFER);
        this.calls = calls;
    }

    public Mono<Quote> quote(String hotelId, QuoteRequest request) {
        return calls.call(HOTEL, true, hotel.post().uri("/api/hotels/{id}/quotes", hotelId).bodyValue(request)
                .retrieve().bodyToMono(Quote.class)).onErrorMap(DownstreamErrors::translate);
    }

    public Mono<List<OfferItemValidation>> validateOffers(RoomSelection room, List<OfferItem> items) {
        CartApi.OfferContext ctx = new CartApi.OfferContext(room.hotelId(), room.destination(), room.checkIn(),
                room.checkOut(), room.roomCode(), room.ratePlanCode(), room.adults(), room.children(), room.currency(),
                room.hotelAmenities(), List.of(), null, null);
        return calls.call(OFFER, true, offer.post().uri("/api/offers/validate")
                .bodyValue(new OfferValidationRequest(ctx, items)).retrieve().bodyToMono(OfferValidationResponse.class))
                .map(OfferValidationResponse::items).onErrorMap(DownstreamErrors::translate);
    }
}
