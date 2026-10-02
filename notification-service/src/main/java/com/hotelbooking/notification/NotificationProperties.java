package com.hotelbooking.notification;

import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("platform.notification")
public class NotificationProperties {

    private int maxSendAttempts = 3;
    private int maxManualRetries = 3;
    private Duration freeCancellationWindow = Duration.ofHours(48);
    private int resendLimitPerBooking = 5;
    private Duration resendBookingWindow = Duration.ofHours(24);
    private int resendLimitPerClient = 10;
    private Duration resendClientWindow = Duration.ofHours(1);
    private boolean simulateDelivery = true;
    private String templateVersion = "confirmation-v2";
    private List<String> locales = List.of("en-GB", "en-US", "fr-FR", "es-ES");

    public int getMaxSendAttempts() {
        return maxSendAttempts;
    }

    public void setMaxSendAttempts(int maxSendAttempts) {
        this.maxSendAttempts = maxSendAttempts;
    }

    public int getMaxManualRetries() {
        return maxManualRetries;
    }

    public void setMaxManualRetries(int maxManualRetries) {
        this.maxManualRetries = maxManualRetries;
    }

    public int getResendLimitPerBooking() {
        return resendLimitPerBooking;
    }

    public void setResendLimitPerBooking(int resendLimitPerBooking) {
        this.resendLimitPerBooking = resendLimitPerBooking;
    }

    public Duration getResendBookingWindow() {
        return resendBookingWindow;
    }

    public void setResendBookingWindow(Duration resendBookingWindow) {
        this.resendBookingWindow = resendBookingWindow;
    }

    public int getResendLimitPerClient() {
        return resendLimitPerClient;
    }

    public void setResendLimitPerClient(int resendLimitPerClient) {
        this.resendLimitPerClient = resendLimitPerClient;
    }

    public Duration getResendClientWindow() {
        return resendClientWindow;
    }

    public void setResendClientWindow(Duration resendClientWindow) {
        this.resendClientWindow = resendClientWindow;
    }

    public boolean isSimulateDelivery() {
        return simulateDelivery;
    }

    public void setSimulateDelivery(boolean simulateDelivery) {
        this.simulateDelivery = simulateDelivery;
    }

    public String getTemplateVersion() {
        return templateVersion;
    }

    public void setTemplateVersion(String templateVersion) {
        this.templateVersion = templateVersion;
    }

    public List<String> getLocales() {
        return locales;
    }

    public void setLocales(List<String> locales) {
        this.locales = locales;
    }

    public Duration getFreeCancellationWindow() {
        return freeCancellationWindow;
    }

    public void setFreeCancellationWindow(Duration freeCancellationWindow) {
        this.freeCancellationWindow = freeCancellationWindow;
    }
}
