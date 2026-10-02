package com.hotelbooking.notification;

import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

/** Epic 6 (AQPI-23): confirmation content, e-mail delivery tracking and safe resend. */
@SpringBootApplication
@EnableConfigurationProperties(NotificationProperties.class)
public class NotificationServiceApplication {

    public static void main(String[] args) {
        new SpringApplicationBuilder(NotificationServiceApplication.class)
                .properties("spring.config.name=notification-service").run(args);
    }
}
