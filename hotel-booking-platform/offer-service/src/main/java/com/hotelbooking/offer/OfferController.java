package com.hotelbooking.offer;

import java.util.List;
import java.util.Map;

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

import com.hotelbooking.common.events.EventNames;
import com.hotelbooking.common.events.EventPublisher;
import com.hotelbooking.common.web.ApiException;
import com.hotelbooking.offer.OfferApi.Consent;
import com.hotelbooking.offer.OfferApi.ConsentRequest;
import com.hotelbooking.offer.OfferApi.Interaction;
import com.hotelbooking.offer.OfferApi.OfferContext;
import com.hotelbooking.offer.OfferApi.OfferResponse;
import com.hotelbooking.offer.OfferApi.ValidationRequest;
import com.hotelbooking.offer.OfferApi.ValidationResponse;

import jakarta.validation.Valid;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api")
public class OfferController {

    private final OfferEngine engine;
    private final ConsentStore consents;
    private final OfferCatalog catalog;
    private final OfferProperties properties;
    private final EventPublisher events;

    public OfferController(OfferEngine engine, ConsentStore consents, OfferCatalog catalog, OfferProperties properties,
            EventPublisher events) {
        this.engine = engine;
        this.consents = consents;
        this.catalog = catalog;
        this.properties = properties;
        this.events = events;
    }

    /** Stories 5.1, 5.2, 5.3 (AQPI-11, AQPI-12, AQPI-13). */
    @PostMapping("/offers/recommendations")
    public Mono<OfferResponse> recommend(@Valid @RequestBody OfferContext context) {
        return Mono.fromSupplier(() -> engine.recommend(context))
                .flatMap(r -> events.event(EventNames.OFFERS_RECOMMENDED).attr("hotelId", context.hotelId())
                        .attr("offers", r.offers().stream().map(o -> o.code() + ":" + String.join("|", o.reasonCodes())).toList())
                        .attr("excluded", r.excluded().stream().map(e -> e.code() + ":" + e.reason()).toList())
                        .attr("personalized", r.personalized()).attr("fallbackReason", r.fallbackReason())
                        .attr("rulesVersion", r.rulesVersion()).attr("modelVersion", r.modelVersion())
                        .publish().thenReturn(r));
    }

    /** Story 6.2 AC4: cart-service re-checks eligibility, stock and quantity limits. */
    @PostMapping("/offers/validate")
    public Mono<ValidationResponse> validate(@Valid @RequestBody ValidationRequest request) {
        return Mono.fromSupplier(() -> new ValidationResponse(engine.validate(request.context(), request.items()),
                properties.getRulesVersion()));
    }

    /** Story 5.2 AC2: add, skip or dismiss. Dismissed offers are not shown again in the session. */
    @PostMapping("/offers/interactions")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Mono<Void> interact(@Valid @RequestBody Interaction interaction) {
        return Mono.fromRunnable(() -> engine.interact(interaction.sessionId(), interaction.offerCode(), interaction.action()))
                .then(events.event(EventNames.OFFER_INTERACTION).attr("offerCode", interaction.offerCode())
                        .attr("action", interaction.action().name()).publish());
    }

    /** Story 5.3 AC3: consent changes apply to the next recommendation. */
    @PutMapping("/consents/{profileId}")
    public Mono<Consent> consent(@PathVariable String profileId, @RequestBody ConsentRequest request) {
        return Mono.fromSupplier(() -> consents.save(profileId, request.personalization(),
                request.interests() == null ? List.of() : request.interests()))
                .flatMap(c -> events.event(EventNames.CONSENT_CHANGED).attr("personalization", c.personalization())
                        .attr("categories", c.interests().size()).publish().thenReturn(c));
    }

    @GetMapping("/consents/{profileId}")
    public Mono<Consent> getConsent(@PathVariable String profileId) {
        return Mono.fromSupplier(() -> consents.find(profileId).orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "CONSENT_NOT_FOUND", "No preferences are stored for this profile.")));
    }

    @DeleteMapping("/consents/{profileId}")
    public Mono<Map<String, Object>> deleteConsent(@PathVariable String profileId) {
        return Mono.fromSupplier(() -> Map.of("profileId", profileId, "deleted", consents.delete(profileId)));
    }

    @PutMapping("/admin/offers/{code}/availability")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> availability(@PathVariable String code, @RequestBody Map<String, Boolean> body) {
        return Mono.fromRunnable(() -> catalog.setAvailable(code, Boolean.TRUE.equals(body.get("available"))));
    }

    @PutMapping("/admin/profile-store")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> profileStore(@RequestBody Map<String, Boolean> body) {
        return Mono.fromRunnable(() -> consents.setAvailable(Boolean.TRUE.equals(body.get("available"))));
    }

    @PostMapping("/admin/reset")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> reset() {
        return Mono.fromRunnable(() -> {
            catalog.reset();
            consents.reset();
            engine.reset();
        });
    }
}
