package com.hotelbooking.cart;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hotelbooking.cart.CartApi.AcknowledgeRequest;
import com.hotelbooking.cart.CartApi.AncillaryRequest;
import com.hotelbooking.cart.CartApi.CartView;
import com.hotelbooking.cart.CartApi.ChangeRoomRequest;
import com.hotelbooking.cart.CartApi.CompleteRequest;
import com.hotelbooking.cart.CartApi.CreateCartRequest;
import com.hotelbooking.cart.CartApi.QuantityRequest;

import jakarta.validation.Valid;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api")
public class CartController {

    private final CartService carts;

    public CartController(CartService carts) {
        this.carts = carts;
    }

    /** Story 6.1 (AQPI-15). */
    @PostMapping("/carts")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<CartView> create(@Valid @RequestBody CreateCartRequest request) {
        return carts.create(request);
    }

    /** Story 6.3 (AQPI-17). */
    @GetMapping("/carts/{cartId}")
    public Mono<CartView> view(@PathVariable String cartId) {
        return carts.view(cartId);
    }

    /** Story 6.2 (AQPI-16). */
    @PostMapping("/carts/{cartId}/ancillaries")
    public Mono<CartView> add(@PathVariable String cartId, @Valid @RequestBody AncillaryRequest request) {
        return carts.addAncillary(cartId, request.code(), request.quantity());
    }

    @PutMapping("/carts/{cartId}/ancillaries/{code}")
    public Mono<CartView> update(@PathVariable String cartId, @PathVariable String code,
            @Valid @RequestBody QuantityRequest request) {
        return carts.updateAncillary(cartId, code, request.quantity());
    }

    @DeleteMapping("/carts/{cartId}/ancillaries/{code}")
    public Mono<CartView> remove(@PathVariable String cartId, @PathVariable String code) {
        return carts.removeAncillary(cartId, code);
    }

    @PutMapping("/carts/{cartId}/room")
    public Mono<CartView> changeRoom(@PathVariable String cartId, @Valid @RequestBody ChangeRoomRequest request) {
        return carts.changeRoom(cartId, request.roomCode(), request.ratePlanCode());
    }

    @PostMapping("/carts/{cartId}/revalidate")
    public Mono<CartView> revalidate(@PathVariable String cartId) {
        return carts.revalidate(cartId);
    }

    @PostMapping("/carts/{cartId}/acknowledge")
    public Mono<CartView> acknowledge(@PathVariable String cartId, @Valid @RequestBody AcknowledgeRequest request) {
        return carts.acknowledge(cartId, request.priceVersion());
    }

    /** Called by reservation-service: revalidated, acknowledged snapshot or 409/410. */
    @PostMapping("/carts/{cartId}/checkout")
    public Mono<CartView> checkout(@PathVariable String cartId) {
        return carts.checkout(cartId);
    }

    @PostMapping("/carts/{cartId}/complete")
    public Mono<CartView> complete(@PathVariable String cartId, @Valid @RequestBody CompleteRequest request) {
        return carts.complete(cartId, request.reservationId());
    }

    @PostMapping("/admin/reset")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> reset() {
        return Mono.fromRunnable(carts::reset);
    }
}
