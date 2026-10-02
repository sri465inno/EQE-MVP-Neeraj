package com.hotelbooking.reservation;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("platform.reservation")
public class ReservationProperties {

    private Duration idempotencyTtl = Duration.ofHours(24);
    private int retentionDays = 365;
    private String privacyNoticeVersion = "privacy-2026-09";
    private Duration freeCancellationWindow = Duration.ofHours(48);

    public Duration getIdempotencyTtl() {
        return idempotencyTtl;
    }

    public void setIdempotencyTtl(Duration idempotencyTtl) {
        this.idempotencyTtl = idempotencyTtl;
    }

    public int getRetentionDays() {
        return retentionDays;
    }

    public void setRetentionDays(int retentionDays) {
        this.retentionDays = retentionDays;
    }

    public String getPrivacyNoticeVersion() {
        return privacyNoticeVersion;
    }

    public void setPrivacyNoticeVersion(String privacyNoticeVersion) {
        this.privacyNoticeVersion = privacyNoticeVersion;
    }

    public Duration getFreeCancellationWindow() {
        return freeCancellationWindow;
    }

    public void setFreeCancellationWindow(Duration freeCancellationWindow) {
        this.freeCancellationWindow = freeCancellationWindow;
    }
}
