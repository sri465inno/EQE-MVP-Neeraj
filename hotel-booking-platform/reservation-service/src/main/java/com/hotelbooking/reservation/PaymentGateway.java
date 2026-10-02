package com.hotelbooking.reservation;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.stereotype.Component;

import com.hotelbooking.common.money.Money;

/**
 * Simulated payment provider, idempotent by key. Test tokens: {@code tok_decline} declines, {@code tok_error}
 * fails before authorising, {@code tok_timeout} authorises but the response is lost, {@code tok_void_fails} cannot
 * be voided. Any other token authorises.
 */
@Component
public class PaymentGateway {

    public enum Result {
        AUTHORIZED,
        DECLINED,
        ERROR,
        TIMEOUT
    }

    public record Authorization(String key, String authorizationId, Result result, Money amount, String mode,
            boolean voided) {
    }

    private final Map<String, Authorization> ledger = new ConcurrentHashMap<>();
    private final Map<String, Boolean> nonVoidable = new ConcurrentHashMap<>();
    private final AtomicInteger calls = new AtomicInteger();

    public Authorization authorize(String key, String token, Money amount, String mode) {
        calls.incrementAndGet();
        Authorization existing = ledger.get(key);
        if (existing != null) {
            return existing.result() == Result.TIMEOUT ? withResult(existing, Result.AUTHORIZED) : existing;
        }
        Result result = switch (token) {
            case "tok_decline" -> Result.DECLINED;
            case "tok_error" -> Result.ERROR;
            case "tok_timeout" -> Result.TIMEOUT;
            default -> Result.AUTHORIZED;
        };
        if (result == Result.ERROR) {
            return new Authorization(key, null, Result.ERROR, amount, mode, false);
        }
        String id = result == Result.DECLINED ? null : "auth_" + UUID.randomUUID().toString().substring(0, 12);
        Authorization recorded = new Authorization(key, id, result, amount, mode, false);
        ledger.put(key, recorded);
        if (token.equals("tok_void_fails")) {
            nonVoidable.put(key, Boolean.TRUE);
        }
        return recorded;
    }

    /** Reconciliation lookup after a lost response. */
    public Optional<Authorization> lookup(String key) {
        return Optional.ofNullable(ledger.get(key)).map(a -> a.result() == Result.TIMEOUT ? withResult(a, Result.AUTHORIZED) : a);
    }

    public boolean voidAuthorization(String key) {
        Authorization a = ledger.get(key);
        if (a == null || nonVoidable.containsKey(key)) {
            return false;
        }
        ledger.put(key, new Authorization(a.key(), a.authorizationId(), a.result(), a.amount(), a.mode(), true));
        return true;
    }

    public List<Authorization> ledger() {
        return List.copyOf(ledger.values());
    }

    public int calls() {
        return calls.get();
    }

    public void reset() {
        ledger.clear();
        nonVoidable.clear();
        calls.set(0);
    }


    private static Authorization withResult(Authorization a, Result r) {
        return new Authorization(a.key(), a.authorizationId(), r, a.amount(), a.mode(), a.voided());
    }
}
