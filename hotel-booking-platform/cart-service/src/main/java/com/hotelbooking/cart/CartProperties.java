package com.hotelbooking.cart;

import java.math.BigDecimal;
import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Cart expiry and the threshold above which a price change needs guest acknowledgement (stories 6.1, 6.3). */
@ConfigurationProperties("platform.cart")
public class CartProperties {

    private Duration ttl = Duration.ofMinutes(30);
    private BigDecimal materialChangePercent = new BigDecimal("1.0");

    public Duration getTtl() {
        return ttl;
    }

    public void setTtl(Duration ttl) {
        this.ttl = ttl;
    }

    public BigDecimal getMaterialChangePercent() {
        return materialChangePercent;
    }

    public void setMaterialChangePercent(BigDecimal materialChangePercent) {
        this.materialChangePercent = materialChangePercent;
    }
}
