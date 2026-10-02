package com.hotelbooking.notification;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hotelbooking.common.events.EventNames;
import com.hotelbooking.common.events.EventPublisher;
import com.hotelbooking.common.web.ApiException;
import com.hotelbooking.notification.NotificationApi.ConfirmationRequest;
import com.hotelbooking.notification.NotificationApi.MessageView;
import com.hotelbooking.notification.NotificationApi.ResendRequest;
import com.hotelbooking.notification.NotificationApi.ResendResponse;
import com.hotelbooking.notification.NotificationApi.Webhook;

import jakarta.validation.Valid;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api")
public class NotificationController {

    public static final String ROLE_HEADER = "X-Operator-Role";
    public static final String CLIENT_HEADER = "X-Client-Id";
    /** Only this operational role sees full e-mail addresses (story 8.2 BR). */
    public static final String EMAIL_OPS = "EMAIL_OPS";

    private final NotificationService notifications;
    private final EventPublisher events;

    public NotificationController(NotificationService notifications, EventPublisher events) {
        this.notifications = notifications;
        this.events = events;
    }

    /** Stories 8.1, 8.2. */
    @PostMapping("/confirmations")
    public Mono<ResponseEntity<MessageView>> confirm(@Valid @RequestBody ConfirmationRequest request) {
        return notifications.confirm(request).map(c -> ResponseEntity
                .status(c.created() ? HttpStatus.CREATED : HttpStatus.OK).body(c.view()));
    }

    /** Story 8.4. */
    @PostMapping("/cancellations")
    public Mono<ResponseEntity<MessageView>> cancellation(@Valid @RequestBody ConfirmationRequest request) {
        return notifications.cancellation(request).map(c -> ResponseEntity
                .status(c.created() ? HttpStatus.CREATED : HttpStatus.OK).body(c.view()));
    }

    @GetMapping("/confirmations/{reservationId}")
    public Mono<MessageView> forReservation(@PathVariable String reservationId) {
        return Mono.fromSupplier(() -> notifications.forReservation(reservationId).orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "MESSAGE_NOT_FOUND", "No confirmation for that reservation.")));
    }

    /** Story 8.3. */
    @PostMapping("/confirmations/resend")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Mono<ResendResponse> resend(@Valid @RequestBody ResendRequest request,
            @RequestHeader(value = CLIENT_HEADER, required = false) String clientId) {
        return notifications.resend(request.confirmationNumber(), request.lastName(), clientId).map(ResendResponse::new);
    }

    @PostMapping("/provider/webhooks")
    public Mono<MessageView> webhook(@Valid @RequestBody Webhook webhook) {
        return notifications.webhook(webhook.providerMessageId(), webhook.event());
    }

    /** Story 8.2 AC4: operations view of delivery states; masked unless EMAIL_OPS, always audited. */
    @GetMapping("/ops/messages")
    public Mono<List<MessageView>> messages(@RequestParam(required = false) String reservationId,
            @RequestHeader(value = ROLE_HEADER, required = false) String role) {
        if (role == null || role.isBlank()) {
            return Mono.error(new ApiException(HttpStatus.FORBIDDEN, "OPERATOR_ROLE_REQUIRED",
                    "An operator role is required to view messages."));
        }
        boolean unmasked = EMAIL_OPS.equals(role);
        return events.event(EventNames.AUDIT_ACCESS).attr("resource", "messages").attr("role", role)
                .attr("unmasked", unmasked).attr("reservationId", reservationId).publish()
                .then(Mono.fromSupplier(() -> notifications.list(reservationId, unmasked)));
    }

    @PostMapping("/ops/messages/{messageId}/retry")
    public Mono<MessageView> retry(@PathVariable String messageId) {
        return notifications.retry(messageId);
    }

    @PostMapping("/admin/reset")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> reset() {
        return Mono.fromRunnable(notifications::reset);
    }
}
