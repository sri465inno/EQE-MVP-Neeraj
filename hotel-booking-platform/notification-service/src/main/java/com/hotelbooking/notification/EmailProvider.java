package com.hotelbooking.notification;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.stereotype.Component;

/**
 * Simulated e-mail provider. Recipients at {@code fail.test} always fail, {@code flaky.test} fail on the first
 * attempt, and {@code bounce.test} are accepted but later bounce.
 */
@Component
public class EmailProvider {

    public static class ProviderException extends RuntimeException {
        public ProviderException() {
            super("provider rejected the send");
        }
    }

    private final Map<String, AtomicInteger> attemptsByRecipient = new ConcurrentHashMap<>();
    private final AtomicInteger accepted = new AtomicInteger();

    public String send(String recipient, String subject, String html, String text) {
        String domain = recipient.substring(recipient.indexOf('@') + 1);
        int attempt = attemptsByRecipient.computeIfAbsent(recipient, k -> new AtomicInteger()).incrementAndGet();
        if (domain.equals("fail.test") || (domain.equals("flaky.test") && attempt == 1)) {
            throw new ProviderException();
        }
        accepted.incrementAndGet();
        return "pm-" + UUID.randomUUID();
    }

    public boolean willBounce(String recipient) {
        return recipient.endsWith("@bounce.test");
    }

    public int acceptedCount() {
        return accepted.get();
    }

    public void reset() {
        attemptsByRecipient.clear();
        accepted.set(0);
    }
}
