package com.hotelbooking.journey;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.test.web.reactive.server.WebTestClient;

import com.hotelbooking.cart.CartServiceApplication;
import com.hotelbooking.common.events.BusinessEvent;
import com.hotelbooking.common.events.EventPublisher;
import com.hotelbooking.hotel.HotelServiceApplication;
import com.hotelbooking.notification.NotificationServiceApplication;
import com.hotelbooking.offer.OfferServiceApplication;
import com.hotelbooking.reservation.ReservationServiceApplication;
import com.hotelbooking.search.SearchServiceApplication;

/** Starts the six services in one JVM on random ports, wired to each other as in a real deployment. */
final class Platform implements AutoCloseable {

    private final Map<String, ConfigurableApplicationContext> contexts = new LinkedHashMap<>();
    private final Map<String, Integer> ports = new LinkedHashMap<>();

    Platform() {
        start("hotel-service", HotelServiceApplication.class);
        start("offer-service", OfferServiceApplication.class);
        start("notification-service", NotificationServiceApplication.class);
        start("search-service", SearchServiceApplication.class, "hotel-service");
        start("cart-service", CartServiceApplication.class, "hotel-service", "offer-service");
        start("reservation-service", ReservationServiceApplication.class, "cart-service", "hotel-service",
                "notification-service");
    }

    private void start(String name, Class<?> app, String... dependencies) {
        List<String> props = new ArrayList<>(List.of("spring.config.name=" + name, "server.port=0",
                "spring.main.banner-mode=off"));
        for (String dep : dependencies) {
            props.add("platform.dependencies." + dep + ".base-url=http://localhost:" + ports.get(dep));
        }
        ConfigurableApplicationContext ctx = new SpringApplicationBuilder(app).properties(props.toArray(String[]::new))
                .run();
        contexts.put(name, ctx);
        ports.put(name, Integer.valueOf(ctx.getEnvironment().getProperty("local.server.port")));
    }

    WebTestClient client(String service) {
        return WebTestClient.bindToServer().baseUrl("http://localhost:" + ports.get(service))
                .responseTimeout(Duration.ofSeconds(20)).build();
    }

    List<BusinessEvent> events(String service) {
        return contexts.get(service).getBean(EventPublisher.class).recent();
    }

    void reset() {
        for (String service : contexts.keySet()) {
            if (!service.equals("search-service")) {
                client(service).post().uri("/api/admin/reset").exchange().expectStatus().is2xxSuccessful();
            }
        }
    }

    @Override
    public void close() {
        List<ConfigurableApplicationContext> all = new ArrayList<>(contexts.values());
        Collections.reverse(all);
        all.forEach(ConfigurableApplicationContext::close);
    }
}
