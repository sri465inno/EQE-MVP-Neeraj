package com.hotelbooking.common.resilience;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** {@code platform.*}: environment code, service name and per-dependency timeout/retry policy (story 9.4). */
@ConfigurationProperties("platform")
public class PlatformProperties {

    private String environment = "local";
    private String service = "unknown";
    private String dataKey;
    private Map<String, Policy> dependencies = new HashMap<>();

    /** Base64 AES-256 key for personal fields at rest; a random key is generated when unset (demo only). */
    public String getDataKey() {
        return dataKey;
    }

    public void setDataKey(String dataKey) {
        this.dataKey = dataKey;
    }

    public String getEnvironment() {
        return environment;
    }

    public void setEnvironment(String environment) {
        this.environment = environment;
    }

    public String getService() {
        return service;
    }

    public void setService(String service) {
        this.service = service;
    }

    public Map<String, Policy> getDependencies() {
        return dependencies;
    }

    public void setDependencies(Map<String, Policy> dependencies) {
        this.dependencies = dependencies;
    }

    public static class Policy {

        private String baseUrl;
        private Duration timeout = Duration.ofSeconds(2);
        private int retries = 1;
        private Duration backoff = Duration.ofMillis(50);

        public String getBaseUrl() {
            return baseUrl;
        }

        public void setBaseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
        }

        public Duration getTimeout() {
            return timeout;
        }

        public void setTimeout(Duration timeout) {
            this.timeout = timeout;
        }

        public int getRetries() {
            return retries;
        }

        public void setRetries(int retries) {
            this.retries = retries;
        }

        public Duration getBackoff() {
            return backoff;
        }

        public void setBackoff(Duration backoff) {
            this.backoff = backoff;
        }
    }
}
