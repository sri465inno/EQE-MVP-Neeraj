package com.hotelbooking.search;

import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

/** Epic 1 (AQPI-2): search, validation and no-availability handling. */
@SpringBootApplication
@EnableConfigurationProperties(SearchRules.class)
public class SearchServiceApplication {

    public static void main(String[] args) {
        new SpringApplicationBuilder(SearchServiceApplication.class).properties("spring.config.name=search-service").run(args);
    }
}
