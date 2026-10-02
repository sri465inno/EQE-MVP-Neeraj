package com.hotelbooking.offer;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("platform.offers")
public class OfferProperties {

    private int maxOffers = 5;
    private int consentRetentionDays = 365;
    private String rulesVersion = "offer-rules-v3";
    private String modelVersion = "contextual-ranker-1.2";

    public int getMaxOffers() {
        return maxOffers;
    }

    public void setMaxOffers(int maxOffers) {
        this.maxOffers = maxOffers;
    }

    public int getConsentRetentionDays() {
        return consentRetentionDays;
    }

    public void setConsentRetentionDays(int consentRetentionDays) {
        this.consentRetentionDays = consentRetentionDays;
    }

    public String getRulesVersion() {
        return rulesVersion;
    }

    public void setRulesVersion(String rulesVersion) {
        this.rulesVersion = rulesVersion;
    }

    public String getModelVersion() {
        return modelVersion;
    }

    public void setModelVersion(String modelVersion) {
        this.modelVersion = modelVersion;
    }
}
