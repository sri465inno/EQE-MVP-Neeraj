package com.hotelbooking.reservation;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

import com.hotelbooking.common.privacy.Masking;
import com.hotelbooking.common.web.FieldIssue;
import com.hotelbooking.reservation.ReservationApi.Guest;
import com.hotelbooking.reservation.ReservationApi.ReservationRequest;

/** Stories 7.1 and 7.2: field-level, plain-language validation; card numbers are rejected without being echoed. */
@Component
public class GuestValidator {

    private static final Pattern NAME = Pattern.compile("[\\p{L}][\\p{L} .'-]{0,49}");
    private static final Pattern EMAIL = Pattern.compile("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}");
    private static final Pattern PHONE = Pattern.compile("\\+?[0-9 ()-]{7,20}");
    private static final Pattern TIME = Pattern.compile("([01][0-9]|2[0-3]):[0-5][0-9]");
    private static final Pattern TOKEN = Pattern.compile("tok_[a-z0-9_]{3,40}");
    private static final int MAX_REQUESTS = 250;

    public List<FieldIssue> validate(ReservationRequest r) {
        List<FieldIssue> issues = new ArrayList<>();
        if (r.cartId() == null || r.cartId().isBlank()) {
            issues.add(new FieldIssue("cartId", "CART_REQUIRED", "Your cart is missing. Please select your room again."));
        }
        Guest g = r.guest();
        if (g == null) {
            issues.add(new FieldIssue("guest", "GUEST_REQUIRED", "Enter the lead guest's details."));
        } else {
            name(issues, "guest.firstName", g.firstName(), "first name");
            name(issues, "guest.lastName", g.lastName(), "last name");
            if (blank(g.email())) {
                issues.add(new FieldIssue("guest.email", "EMAIL_REQUIRED", "Enter an e-mail address for your confirmation."));
            } else if (!EMAIL.matcher(g.email().trim()).matches()) {
                issues.add(new FieldIssue("guest.email", "EMAIL_FORMAT", "Enter an e-mail address like name@example.com."));
            }
            if (!blank(g.phone()) && !PHONE.matcher(g.phone().trim()).matches()) {
                issues.add(new FieldIssue("guest.phone", "PHONE_FORMAT", "Enter a phone number using digits, spaces and an optional +."));
            }
            if (!blank(g.arrivalTime()) && !TIME.matcher(g.arrivalTime().trim()).matches()) {
                issues.add(new FieldIssue("guest.arrivalTime", "ARRIVAL_TIME_FORMAT", "Enter an arrival time like 15:30."));
            }
            if (!blank(g.specialRequests())) {
                if (g.specialRequests().length() > MAX_REQUESTS) {
                    issues.add(new FieldIssue("guest.specialRequests", "REQUESTS_TOO_LONG",
                            "Special requests must be " + MAX_REQUESTS + " characters or fewer."));
                }
                if (Masking.looksLikeCard(g.specialRequests())) {
                    issues.add(new FieldIssue("guest.specialRequests", "CARD_DATA_NOT_ALLOWED",
                            "Please don't enter card numbers here. Card details go only in the secure payment field."));
                }
            }
        }
        if (blank(r.paymentToken())) {
            issues.add(new FieldIssue("paymentToken", "PAYMENT_REQUIRED", "Enter your card in the secure payment field."));
        } else if (Masking.looksLikeCard(r.paymentToken())) {
            issues.add(new FieldIssue("paymentToken", "RAW_CARD_REJECTED",
                    "Card numbers can't be sent directly. Please use the secure payment field."));
        } else if (!TOKEN.matcher(r.paymentToken()).matches()) {
            issues.add(new FieldIssue("paymentToken", "PAYMENT_TOKEN_INVALID",
                    "We couldn't read your payment details. Please re-enter your card in the secure payment field."));
        }
        if (!r.privacyNoticeAccepted()) {
            issues.add(new FieldIssue("privacyNoticeAccepted", "PRIVACY_NOTICE_REQUIRED",
                    "Please confirm you have read the privacy notice."));
        }
        return issues;
    }

    private static void name(List<FieldIssue> issues, String field, String value, String label) {
        if (blank(value)) {
            issues.add(new FieldIssue(field, "NAME_REQUIRED", "Enter the lead guest's " + label + "."));
        } else if (!NAME.matcher(value.trim()).matches()) {
            issues.add(new FieldIssue(field, "NAME_FORMAT", "The " + label + " can contain letters, spaces, hyphens and apostrophes (up to 50)."));
        }
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
