package com.hotelbooking.search;

import java.util.Map;

import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriBuilder;

import com.hotelbooking.common.PlatformAutoConfiguration;
import com.hotelbooking.common.resilience.DependencyCalls;
import com.hotelbooking.common.resilience.PlatformProperties;
import com.hotelbooking.common.web.DownstreamErrors;
import com.hotelbooking.search.SearchApi.Criteria;
import com.hotelbooking.search.SearchApi.HotelPage;

import reactor.core.publisher.Mono;

/** Calls hotel-service availability through timeout, retry and circuit breaker (story 9.4). */
@Component
public class HotelClient {

    public static final String DEPENDENCY = "hotel-service";

    private final WebClient client;
    private final DependencyCalls calls;

    public HotelClient(WebClient.Builder builder, PlatformProperties properties, DependencyCalls calls) {
        this.client = PlatformAutoConfiguration.client(builder, properties, DEPENDENCY);
        this.calls = calls;
    }

    public Mono<HotelPage> availability(Criteria c, Map<String, String> refinements) {
        return calls.call(DEPENDENCY, true, client.get().uri(b -> {
            UriBuilder u = b.path("/api/hotels/availability")
                    .queryParam("destination", c.destination())
                    .queryParam("checkIn", c.checkIn())
                    .queryParam("checkOut", c.checkOut())
                    .queryParam("rooms", c.rooms())
                    .queryParam("adults", c.adults())
                    .queryParam("children", c.children());
            refinements.forEach(u::queryParam);
            return u.build();
        }).retrieve().bodyToMono(HotelPage.class)).onErrorMap(DownstreamErrors::translate);
    }
}
