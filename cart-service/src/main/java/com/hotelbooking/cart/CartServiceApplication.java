package com.hotelbooking.cart;

import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

/** Epic 4 (AQPI-14): cart, ancillaries, itemised totals and price revalidation. */
@SpringBootApplication
@EnableConfigurationProperties(CartProperties.class)
public class CartServiceApplication {

    public static void main(String[] args) {
        new SpringApplicationBuilder(CartServiceApplication.class).properties("spring.config.name=cart-service").run(args);
    }
}
