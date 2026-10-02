package com.hotelbooking.common.privacy;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;
import java.util.regex.Pattern;

/** Masking and pseudonymisation helpers (story 9.1, AQPI-28). */
public final class Masking {

    private static final Pattern EMAIL = Pattern.compile("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}");
    private static final Pattern CARD = Pattern.compile("\\b(?:\\d[ -]?){12,18}\\d\\b");

    private Masking() {
    }

    /** {@code jane.doe@example.com} becomes {@code j***@e***.com}. */
    public static String email(String email) {
        if (email == null || !email.contains("@")) {
            return "***";
        }
        String[] parts = email.split("@", 2);
        String domain = parts[1];
        int dot = domain.lastIndexOf('.');
        String tld = dot >= 0 ? domain.substring(dot) : "";
        return first(parts[0]) + "***@" + first(domain) + "***" + tld;
    }

    public static String phone(String phone) {
        if (phone == null) {
            return null;
        }
        String digits = phone.replaceAll("\\D", "");
        return digits.length() <= 2 ? "***" : "***" + digits.substring(digits.length() - 2);
    }

    /** Removes e-mail addresses and card-like numbers from free text before it reaches a log. */
    public static String scrub(String text) {
        if (text == null) {
            return null;
        }
        return CARD.matcher(EMAIL.matcher(text).replaceAll("[email]")).replaceAll("[card]");
    }

    /** True when the text contains something shaped like a card number (PAN). */
    public static boolean looksLikeCard(String text) {
        return text != null && CARD.matcher(text).find();
    }

    /** Stable, non-reversible token for lookups, e.g. resend verification (story 8.3). */
    public static String fingerprint(String... values) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            for (String v : values) {
                digest.update((v == null ? "" : v.trim().toLowerCase(Locale.ROOT)).getBytes(StandardCharsets.UTF_8));
                digest.update((byte) 0);
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String first(String s) {
        return s.isEmpty() ? "" : s.substring(0, 1);
    }
}
