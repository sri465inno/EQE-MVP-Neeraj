package com.hotelbooking.search;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configurable search rules (stories 3.1 BR, 3.2 BR). Market entries override the defaults for one destination.
 */
@ConfigurationProperties("platform.search")
public class SearchRules {

    private Limits defaults = new Limits();
    private Map<String, Limits> markets = new HashMap<>();
    private List<String> destinations = List.of("NYC", "LON", "PAR");
    private Duration sessionTtl = Duration.ofMinutes(15);
    private String zone = "UTC";

    public Limits limitsFor(String destination) {
        Limits market = destination == null ? null : markets.get(destination.toUpperCase(Locale.ROOT));
        return market == null ? defaults : defaults.overriddenBy(market);
    }

    public Limits getDefaults() {
        return defaults;
    }

    public void setDefaults(Limits defaults) {
        this.defaults = defaults;
    }

    public Map<String, Limits> getMarkets() {
        return markets;
    }

    public void setMarkets(Map<String, Limits> markets) {
        this.markets = markets;
    }

    public List<String> getDestinations() {
        return destinations;
    }

    public void setDestinations(List<String> destinations) {
        this.destinations = destinations;
    }

    public Duration getSessionTtl() {
        return sessionTtl;
    }

    public void setSessionTtl(Duration sessionTtl) {
        this.sessionTtl = sessionTtl;
    }

    public String getZone() {
        return zone;
    }

    public void setZone(String zone) {
        this.zone = zone;
    }

    public static class Limits {

        private Integer maxStayNights = 30;
        private Integer maxAdvanceDays = 500;
        private Integer maxRooms = 8;
        private Integer maxAdultsPerRoom = 4;
        private Integer maxChildrenPerRoom = 3;

        Limits overriddenBy(Limits o) {
            Limits l = new Limits();
            l.maxStayNights = o.maxStayNights != null ? o.maxStayNights : maxStayNights;
            l.maxAdvanceDays = o.maxAdvanceDays != null ? o.maxAdvanceDays : maxAdvanceDays;
            l.maxRooms = o.maxRooms != null ? o.maxRooms : maxRooms;
            l.maxAdultsPerRoom = o.maxAdultsPerRoom != null ? o.maxAdultsPerRoom : maxAdultsPerRoom;
            l.maxChildrenPerRoom = o.maxChildrenPerRoom != null ? o.maxChildrenPerRoom : maxChildrenPerRoom;
            return l;
        }

        public Integer getMaxStayNights() {
            return maxStayNights;
        }

        public void setMaxStayNights(Integer maxStayNights) {
            this.maxStayNights = maxStayNights;
        }

        public Integer getMaxAdvanceDays() {
            return maxAdvanceDays;
        }

        public void setMaxAdvanceDays(Integer maxAdvanceDays) {
            this.maxAdvanceDays = maxAdvanceDays;
        }

        public Integer getMaxRooms() {
            return maxRooms;
        }

        public void setMaxRooms(Integer maxRooms) {
            this.maxRooms = maxRooms;
        }

        public Integer getMaxAdultsPerRoom() {
            return maxAdultsPerRoom;
        }

        public void setMaxAdultsPerRoom(Integer maxAdultsPerRoom) {
            this.maxAdultsPerRoom = maxAdultsPerRoom;
        }

        public Integer getMaxChildrenPerRoom() {
            return maxChildrenPerRoom;
        }

        public void setMaxChildrenPerRoom(Integer maxChildrenPerRoom) {
            this.maxChildrenPerRoom = maxChildrenPerRoom;
        }
    }
}
