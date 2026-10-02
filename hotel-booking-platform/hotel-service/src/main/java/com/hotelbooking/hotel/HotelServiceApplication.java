package com.hotelbooking.hotel;

import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;

/** Epic 2 (AQPI-6): hotel content, availability, rates, inventory and quotes. */
@SpringBootApplication
public class HotelServiceApplication {

    public static void main(String[] args) {
        new SpringApplicationBuilder(HotelServiceApplication.class).properties("spring.config.name=hotel-service").run(args);
    }
}
