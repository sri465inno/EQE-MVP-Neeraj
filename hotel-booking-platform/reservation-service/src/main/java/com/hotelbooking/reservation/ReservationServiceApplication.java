package com.hotelbooking.reservation;

import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

/** Epic 5 (AQPI-18): guest details, payment authorisation, idempotent reservation and booking outcome. */
@SpringBootApplication
@EnableConfigurationProperties(ReservationProperties.class)
public class ReservationServiceApplication {

    public static void main(String[] args) {
        new SpringApplicationBuilder(ReservationServiceApplication.class)
                .properties("spring.config.name=reservation-service").run(args);
    }
}
