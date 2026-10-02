package com.hotelbooking.notification;

import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.FormatStyle;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.hotelbooking.notification.NotificationApi.ConfirmationRequest;
import com.hotelbooking.notification.NotificationApi.Item;

/**
 * Localised, accessible confirmation e-mail (stories 8.1, 9.3 AC4): lang attribute, title, headings, a captioned
 * table with header cells, text labels rather than colour, and a plain-text alternative.
 */
@Component
public class TemplateRenderer {

    public record Rendered(String locale, String subject, String html, String text) {
    }

    private static final Map<String, Map<String, String>> LABELS = Map.of(
            "en", labels("subject", "Your booking is confirmed - %s", "title", "Booking confirmed", "hello", "Hello %s,",
                    "intro", "Your reservation is confirmed.", "number", "Confirmation number", "stay", "Your stay",
                    "checkIn", "Check-in", "checkOut", "Check-out", "items", "What you booked", "total", "Total",
                    "policies", "Policies", "freeUntil", "Free cancellation until %s (%d hours before check-in).",
                    "cancelSubject", "Your booking is cancelled - %s", "cancelTitle", "Booking cancelled",
                    "cancelIntro", "Your reservation has been cancelled free of charge. No payment will be taken."),
            "fr", labels("subject", "Votre réservation est confirmée - %s", "title", "Réservation confirmée",
                    "hello", "Bonjour %s,", "intro", "Votre réservation est confirmée.", "number", "Numéro de confirmation",
                    "stay", "Votre séjour", "checkIn", "Arrivée", "checkOut", "Départ", "items", "Votre réservation",
                    "total", "Total", "policies", "Conditions",
                    "freeUntil", "Annulation gratuite jusqu'au %s (%d heures avant l'arrivée).",
                    "cancelSubject", "Votre réservation est annulée - %s", "cancelTitle", "Réservation annulée",
                    "cancelIntro", "Votre réservation a été annulée sans frais. Aucun paiement ne sera prélevé."),
            "es", labels("subject", "Su reserva está confirmada - %s", "title", "Reserva confirmada",
                    "hello", "Hola %s:", "intro", "Su reserva está confirmada.", "number", "Número de confirmación",
                    "stay", "Su estancia", "checkIn", "Entrada", "checkOut", "Salida", "items", "Lo que ha reservado",
                    "total", "Total", "policies", "Condiciones",
                    "freeUntil", "Cancelación gratuita hasta el %s (%d horas antes de la entrada).",
                    "cancelSubject", "Su reserva está cancelada - %s", "cancelTitle", "Reserva cancelada",
                    "cancelIntro", "Su reserva se ha cancelado sin coste. No se cobrará ningún importe."));

    private static final DateTimeFormatter DEADLINE = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm 'UTC'");

    private final NotificationProperties properties;

    private static Map<String, String> labels(String... pairs) {
        Map<String, String> map = new HashMap<>();
        for (int i = 0; i < pairs.length; i += 2) {
            map.put(pairs[i], pairs[i + 1]);
        }
        return Map.copyOf(map);
    }

    public TemplateRenderer(NotificationProperties properties) {
        this.properties = properties;
    }

    public String resolveLocale(String requested) {
        return requested != null && properties.getLocales().contains(requested) ? requested : properties.getLocales().get(0);
    }

    public Rendered render(ConfirmationRequest r) {
        String tag = resolveLocale(r.locale());
        Locale locale = Locale.forLanguageTag(tag);
        Map<String, String> l = LABELS.getOrDefault(locale.getLanguage(), LABELS.get("en"));
        DateTimeFormatter dates = DateTimeFormatter.ofLocalizedDate(FormatStyle.LONG).withLocale(locale);
        String subject = l.get("subject").formatted(r.confirmationNumber());
        String checkIn = r.checkIn().format(dates) + (r.hotel().checkInFrom() == null ? "" : " (" + r.hotel().checkInFrom() + ")");
        String checkOut = r.checkOut().format(dates) + (r.hotel().checkOutUntil() == null ? "" : " (" + r.hotel().checkOutUntil() + ")");
        String deadline = freeCancellationDeadline(r, l);
        String payment = "PAY_NOW".equals(r.paymentRule()) ? "Paid in full at booking" : "Pay at the hotel";
        StringBuilder rows = new StringBuilder();
        StringBuilder textRows = new StringBuilder();
        if (r.items() != null) {
            for (Item i : r.items()) {
                rows.append("<tr><td>").append(esc(i.label())).append("</td><td>").append(i.quantity())
                        .append("</td><td>").append(amount(i)).append("</td></tr>\n");
                textRows.append("- ").append(i.label()).append(" x").append(i.quantity()).append(": ").append(amount(i)).append('\n');
            }
        }
        String total = r.total().amount().toPlainString() + " " + r.total().currency();
        String html = """
                <!DOCTYPE html>
                <html lang="%s">
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>%s</title></head>
                <body>
                <main role="main" style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#1a1a1a">
                <h1>%s</h1>
                <p>%s</p>
                <p>%s</p>
                <p><strong>%s:</strong> %s</p>
                <h2>%s</h2>
                <p>%s<br>%s</p>
                <dl><dt>%s</dt><dd>%s</dd><dt>%s</dt><dd>%s</dd><dt>Room</dt><dd>%s - %s</dd>
                <dt>Guests</dt><dd>%d room(s), %d adult(s), %d child(ren)</dd></dl>
                <h2>%s</h2>
                <table>
                <caption>%s</caption>
                <thead><tr><th scope="col">Item</th><th scope="col">Qty</th><th scope="col">Amount</th></tr></thead>
                <tbody>
                %s</tbody>
                <tfoot><tr><th scope="row" colspan="2">%s</th><td>%s</td></tr></tfoot>
                </table>
                <p>Payment: %s</p>
                <h2>%s</h2>
                <p>%s</p>%s
                </main>
                </body>
                </html>
                """.formatted(tag, esc(subject), esc(l.get("title")), esc(l.get("hello").formatted(r.guestFirstName())),
                esc(l.get("intro")), esc(l.get("number")), esc(r.confirmationNumber()), esc(l.get("stay")),
                esc(r.hotel().name()), esc(join(r.hotel().address(), r.hotel().city())), esc(l.get("checkIn")),
                esc(checkIn), esc(l.get("checkOut")), esc(checkOut), esc(r.roomName()), esc(r.ratePlanName()),
                r.rooms(), r.adults(), r.children(), esc(l.get("items")), esc(l.get("items")), rows,
                esc(l.get("total")), esc(total), esc(payment), esc(l.get("policies")), esc(r.cancellationTerms()),
                deadline.isEmpty() ? "" : "\n<p><strong>" + esc(deadline) + "</strong></p>");
        String text = l.get("title") + "\n\n" + l.get("hello").formatted(r.guestFirstName()) + "\n" + l.get("intro") + "\n\n"
                + l.get("number") + ": " + r.confirmationNumber() + "\n\n" + r.hotel().name() + ", "
                + join(r.hotel().address(), r.hotel().city()) + "\n" + l.get("checkIn") + ": " + checkIn + "\n"
                + l.get("checkOut") + ": " + checkOut + "\nRoom: " + r.roomName() + " - " + r.ratePlanName() + "\n\n"
                + l.get("items") + ":\n" + textRows + l.get("total") + ": " + total + "\nPayment: " + payment + "\n\n"
                + l.get("policies") + ": " + r.cancellationTerms() + "\n" + (deadline.isEmpty() ? "" : deadline + "\n");
        return new Rendered(tag, subject, html, text);
    }

    /** Story 8.1 (release 2.0): a refundable booking states when free cancellation closes. */
    private String freeCancellationDeadline(ConfirmationRequest r, Map<String, String> l) {
        if (!Boolean.TRUE.equals(r.refundable())) {
            return "";
        }
        long hours = properties.getFreeCancellationWindow().toHours();
        String at = r.checkIn().atStartOfDay(ZoneOffset.UTC).minus(properties.getFreeCancellationWindow()).format(DEADLINE);
        return l.get("freeUntil").formatted(at, hours);
    }

    /** Story 8.4: cancellation e-mail with the same accessibility rules as the confirmation. */
    public Rendered renderCancellation(ConfirmationRequest r) {
        String tag = resolveLocale(r.locale());
        Locale locale = Locale.forLanguageTag(tag);
        Map<String, String> l = LABELS.getOrDefault(locale.getLanguage(), LABELS.get("en"));
        DateTimeFormatter dates = DateTimeFormatter.ofLocalizedDate(FormatStyle.LONG).withLocale(locale);
        String subject = l.get("cancelSubject").formatted(r.confirmationNumber());
        String hello = l.get("hello").formatted(r.guestFirstName());
        String stay = r.hotel().name() + " - " + r.checkIn().format(dates) + " / " + r.checkOut().format(dates);
        String html = """
                <!DOCTYPE html>
                <html lang="%s">
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>%s</title></head>
                <body>
                <main role="main" style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#1a1a1a">
                <h1>%s</h1>
                <p>%s</p>
                <p>%s</p>
                <p><strong>%s:</strong> %s</p>
                <h2>%s</h2>
                <p>%s</p>
                </main>
                </body>
                </html>
                """.formatted(tag, esc(subject), esc(l.get("cancelTitle")), esc(hello), esc(l.get("cancelIntro")),
                esc(l.get("number")), esc(r.confirmationNumber()), esc(l.get("stay")), esc(stay));
        String text = l.get("cancelTitle") + "\n\n" + hello + "\n" + l.get("cancelIntro") + "\n\n" + l.get("number") + ": "
                + r.confirmationNumber() + "\n" + stay + "\n";
        return new Rendered(tag, subject, html, text);
    }

    private static String amount(Item i) {
        return i.amount().amount().toPlainString() + " " + i.amount().currency();
    }

    private static String join(String a, String b) {
        return a == null ? (b == null ? "" : b) : b == null ? a : a + ", " + b;
    }

    static String esc(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
