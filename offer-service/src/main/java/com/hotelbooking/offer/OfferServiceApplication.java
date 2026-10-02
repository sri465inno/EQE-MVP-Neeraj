package com.hotelbooking.offer;

import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

/** Epic 3 (AQPI-10): eligible, explainable, consent-aware ancillary offers. */
@SpringBootApplication
@EnableConfigurationProperties(OfferProperties.class)
public class OfferServiceApplication {

    public static void main(String[] args) {
        new SpringApplicationBuilder(OfferServiceApplication.class).properties("spring.config.name=offer-service").run(args);
    }
}
