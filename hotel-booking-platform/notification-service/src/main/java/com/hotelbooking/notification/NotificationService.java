package com.hotelbooking.notification;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.hotelbooking.common.events.EventNames;
import com.hotelbooking.common.events.EventPublisher;
import com.hotelbooking.common.privacy.FieldCipher;
import com.hotelbooking.common.privacy.Masking;
import com.hotelbooking.common.web.ApiException;
import com.hotelbooking.notification.NotificationApi.ConfirmationRequest;
import com.hotelbooking.notification.NotificationApi.DeliveryStatus;
import com.hotelbooking.notification.NotificationApi.Kind;
import com.hotelbooking.notification.NotificationApi.MessageView;
import com.hotelbooking.notification.NotificationApi.StatusChange;

import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;
import reactor.util.retry.Retry;

/** Stories 8.1, 8.2, 8.3 (AQPI-24, AQPI-25, AQPI-26). */
@Service
public class NotificationService {

    public static final String GENERIC_RESEND = "If the details match a confirmed booking, we have sent the confirmation to the e-mail address on the booking.";

    static final class Message {
        final String id;
        final String reservationId;
        final String confirmationNumber;
        final Kind kind;
        final String locale;
        final String templateVersion;
        final String recipientSealed;
        final String recipientMasked;
        final String subject;
        final String html;
        final String text;
        final Instant createdAt;
        final List<StatusChange> history = new ArrayList<>();
        DeliveryStatus status = DeliveryStatus.QUEUED;
        int attempts;
        int manualRetries;
        String providerMessageId;

        Message(String id, String reservationId, String confirmationNumber, Kind kind, String locale, String templateVersion,
                String recipientSealed, String recipientMasked, TemplateRenderer.Rendered content, Instant createdAt) {
            this.id = id;
            this.reservationId = reservationId;
            this.confirmationNumber = confirmationNumber;
            this.kind = kind;
            this.locale = locale;
            this.templateVersion = templateVersion;
            this.recipientSealed = recipientSealed;
            this.recipientMasked = recipientMasked;
            this.subject = content.subject();
            this.html = content.html();
            this.text = content.text();
            this.createdAt = createdAt;
        }
    }

    record Booking(String reservationId, String lastNameFingerprint, ConfirmationRequest sealedRequest) {
    }

    private final Map<String, Message> messages = new ConcurrentHashMap<>();
    private final Map<String, String> confirmationByReservation = new ConcurrentHashMap<>();
    private final Map<String, Booking> bookings = new ConcurrentHashMap<>();
    private final Map<String, Deque<Instant>> resendsByBooking = new ConcurrentHashMap<>();
    private final Map<String, Deque<Instant>> resendsByClient = new ConcurrentHashMap<>();
    private final TemplateRenderer renderer;
    private final EmailProvider provider;
    private final FieldCipher cipher;
    private final NotificationProperties properties;
    private final EventPublisher events;
    private final Clock clock;

    public NotificationService(TemplateRenderer renderer, EmailProvider provider, FieldCipher cipher,
            NotificationProperties properties, EventPublisher events, Clock clock) {
        this.renderer = renderer;
        this.provider = provider;
        this.cipher = cipher;
        this.properties = properties;
        this.events = events;
        this.clock = clock;
    }

    public record Created(MessageView view, boolean created) {
    }

    /** One confirmation per reservation; repeats return the original (story 8.2 AC1). */
    public Mono<Created> confirm(ConfirmationRequest r) {
        if (!"CONFIRMED".equals(r.status())) {
            return Mono.error(new ApiException(HttpStatus.CONFLICT, "RESERVATION_NOT_CONFIRMED",
                    "A confirmation can only be sent for a confirmed reservation."));
        }
        Message message;
        boolean created;
        synchronized (this) {
            String existing = confirmationByReservation.get(r.reservationId());
            if (existing != null) {
                message = messages.get(existing);
                created = false;
            } else {
                ConfirmationRequest sealed = seal(r);
                bookings.put(r.confirmationNumber().toUpperCase(Locale.ROOT),
                        new Booking(r.reservationId(), Masking.fingerprint(r.guestLastName()), sealed));
                message = newMessage(r, Kind.CONFIRMATION);
                confirmationByReservation.put(r.reservationId(), message.id);
                created = true;
            }
        }
        Mono<Void> send = created ? deliver(message, r.guestEmail()) : Mono.empty();
        return send.then(events.event(EventNames.CONFIRMATION_GENERATED).attr("reservationId", r.reservationId())
                .attr("templateVersion", message.templateVersion).attr("locale", message.locale)
                .attr("created", created).publish())
                .then(Mono.fromSupplier(() -> new Created(view(message, false), created)));
    }

    /** Story 8.3: verify without revealing anything, rate-limit, then send a new message event. */
    public Mono<String> resend(String confirmationNumber, String lastName, String clientId) {
        Instant now = clock.instant();
        String client = clientId == null || clientId.isBlank() ? "anonymous" : clientId;
        if (!allow(resendsByClient, client, properties.getResendLimitPerClient(), properties.getResendClientWindow(), now)) {
            return events.event(EventNames.RESEND_REQUESTED).outcome("rate_limited_client").publish()
                    .then(Mono.error(tooMany()));
        }
        Booking booking = bookings.get(confirmationNumber.trim().toUpperCase(Locale.ROOT));
        if (booking == null || !booking.lastNameFingerprint().equals(Masking.fingerprint(lastName))) {
            return events.event(EventNames.RESEND_REQUESTED).outcome("not_verified").publish().thenReturn(GENERIC_RESEND);
        }
        if (!allow(resendsByBooking, booking.reservationId(), properties.getResendLimitPerBooking(),
                properties.getResendBookingWindow(), now)) {
            return events.event(EventNames.RESEND_REQUESTED).outcome("rate_limited_booking")
                    .attr("reservationId", booking.reservationId()).publish().then(Mono.error(tooMany()));
        }
        ConfirmationRequest r = unseal(booking.sealedRequest());
        Message message = newMessage(r, Kind.RESEND);
        return deliver(message, r.guestEmail())
                .then(events.event(EventNames.RESEND_REQUESTED).outcome("sent").attr("reservationId", booking.reservationId())
                        .attr("messageId", message.id).publish())
                .thenReturn(GENERIC_RESEND);
    }

    public Mono<MessageView> webhook(String providerMessageId, DeliveryStatus event) {
        Message message = messages.values().stream().filter(m -> providerMessageId.equals(m.providerMessageId)).findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MESSAGE_NOT_FOUND", "Unknown provider message."));
        transition(message, event, "provider webhook");
        return emailStatus(message).thenReturn(view(message, false));
    }

    /** Ops retry for a FAILED message, capped so guests are not spammed (story 8.2 AC3). */
    public Mono<MessageView> retry(String messageId) {
        Message message = Optional.ofNullable(messages.get(messageId)).orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "MESSAGE_NOT_FOUND", "Unknown message."));
        synchronized (message) {
            if (message.status != DeliveryStatus.FAILED) {
                throw new ApiException(HttpStatus.CONFLICT, "RETRY_NOT_ALLOWED", "Only failed messages can be retried.");
            }
            if (message.manualRetries >= properties.getMaxManualRetries()) {
                throw new ApiException(HttpStatus.CONFLICT, "RETRY_LIMIT_REACHED", "This message has reached its retry limit.");
            }
            message.manualRetries++;
        }
        return deliver(message, cipher.decrypt(message.recipientSealed)).thenReturn(view(message, false));
    }

    public List<MessageView> list(String reservationId, boolean unmasked) {
        return messages.values().stream()
                .filter(m -> reservationId == null || reservationId.equals(m.reservationId))
                .sorted((a, b) -> a.createdAt.compareTo(b.createdAt))
                .map(m -> view(m, unmasked)).toList();
    }

    public Optional<MessageView> forReservation(String reservationId) {
        return Optional.ofNullable(confirmationByReservation.get(reservationId)).map(messages::get).map(m -> view(m, false));
    }

    public void reset() {
        messages.clear();
        confirmationByReservation.clear();
        bookings.clear();
        resendsByBooking.clear();
        resendsByClient.clear();
        provider.reset();
    }

    private Message newMessage(ConfirmationRequest r, Kind kind) {
        TemplateRenderer.Rendered content = renderer.render(r);
        Message message = new Message("M-" + UUID.randomUUID().toString().substring(0, 8), r.reservationId(),
                r.confirmationNumber(), kind, content.locale(), properties.getTemplateVersion(),
                cipher.encrypt(r.guestEmail()), Masking.email(r.guestEmail()), content, clock.instant());
        message.history.add(new StatusChange(DeliveryStatus.QUEUED, clock.instant(), kind.name()));
        messages.put(message.id, message);
        return message;
    }

    private Mono<Void> deliver(Message message, String recipient) {
        return Mono.fromCallable(() -> {
            synchronized (message) {
                message.attempts++;
            }
            return provider.send(recipient, message.subject, message.html, message.text);
        }).subscribeOn(Schedulers.boundedElastic())
                .retryWhen(Retry.backoff(properties.getMaxSendAttempts() - 1L, Duration.ofMillis(20))
                        .filter(EmailProvider.ProviderException.class::isInstance)
                        .onRetryExhaustedThrow((spec, signal) -> signal.failure()))
                .doOnNext(id -> {
                    message.providerMessageId = id;
                    transition(message, DeliveryStatus.SENT, "accepted by provider");
                    if (properties.isSimulateDelivery()) {
                        transition(message, provider.willBounce(recipient) ? DeliveryStatus.BOUNCED : DeliveryStatus.DELIVERED,
                                "simulated provider webhook");
                    }
                })
                .then()
                .onErrorResume(EmailProvider.ProviderException.class, e -> {
                    transition(message, DeliveryStatus.FAILED, "provider rejected after " + message.attempts + " attempt(s)");
                    return Mono.empty();
                })
                .then(Mono.defer(() -> emailStatus(message)));
    }

    private Mono<Void> emailStatus(Message message) {
        return events.event(EventNames.EMAIL_STATUS).outcome(message.status.name().toLowerCase(Locale.ROOT))
                .attr("messageId", message.id).attr("reservationId", message.reservationId)
                .attr("kind", message.kind.name()).attr("attempts", message.attempts).publish();
    }

    private void transition(Message message, DeliveryStatus status, String detail) {
        synchronized (message) {
            message.status = status;
            message.history.add(new StatusChange(status, clock.instant(), detail));
        }
    }

    private MessageView view(Message m, boolean unmasked) {
        synchronized (m) {
            return new MessageView(m.id, m.reservationId, m.confirmationNumber, m.kind, m.locale, m.templateVersion,
                    unmasked ? cipher.decrypt(m.recipientSealed) : m.recipientMasked, m.status, m.attempts,
                    List.copyOf(m.history), m.subject, m.html, m.text, m.createdAt);
        }
    }

    private ConfirmationRequest seal(ConfirmationRequest r) {
        return new ConfirmationRequest(r.reservationId(), r.confirmationNumber(), r.status(), r.locale(),
                cipher.encrypt(r.guestFirstName()), cipher.encrypt(r.guestLastName()), cipher.encrypt(r.guestEmail()),
                r.hotel(), r.checkIn(), r.checkOut(), r.nights(), r.rooms(), r.adults(), r.children(), r.roomName(),
                r.ratePlanName(), r.items(), r.total(), r.paymentRule(), r.cancellationTerms());
    }

    private ConfirmationRequest unseal(ConfirmationRequest r) {
        return new ConfirmationRequest(r.reservationId(), r.confirmationNumber(), r.status(), r.locale(),
                cipher.decrypt(r.guestFirstName()), cipher.decrypt(r.guestLastName()), cipher.decrypt(r.guestEmail()),
                r.hotel(), r.checkIn(), r.checkOut(), r.nights(), r.rooms(), r.adults(), r.children(), r.roomName(),
                r.ratePlanName(), r.items(), r.total(), r.paymentRule(), r.cancellationTerms());
    }

    private static boolean allow(Map<String, Deque<Instant>> buckets, String key, int limit, Duration window, Instant now) {
        Deque<Instant> bucket = buckets.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (bucket) {
            while (!bucket.isEmpty() && !bucket.peekFirst().isAfter(now.minus(window))) {
                bucket.removeFirst();
            }
            if (bucket.size() >= limit) {
                return false;
            }
            bucket.addLast(now);
            return true;
        }
    }

    private static ApiException tooMany() {
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RESEND_RATE_LIMITED",
                "Too many resend requests. Please wait before trying again.", true, List.of());
    }
}
