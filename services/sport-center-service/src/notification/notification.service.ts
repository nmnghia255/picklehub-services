import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BookingCancelReason } from "../booking/booking-cancel-reason";

export interface BookingCancellationRecipient {
  playerId: string;
  playerEmail?: string;
  playerName?: string;
  bookingId: string;
  date: Date;
  startTime: string;
  endTime: string;
  bookingDetailsHtml?: string;
}

/**
 * Thin client that fans out booking-cancellation notifications to the central
 * notification-service. Failures are logged and swallowed - the caller's
 * transaction MUST NOT roll back because notification-service is unavailable.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  /**
   * Expected to already point at the notification-service module (e.g. http://notification-service:PORT/api/notification). Append /send only, matching the same convention group-service uses.
   */
  private readonly serviceUrl?: string;
  private readonly serviceToken?: string;

  constructor(private readonly configService: ConfigService) {
    this.serviceUrl = this.configService.get<string>(
      "NOTIFICATION_SERVICE_URL"
    );
    this.serviceToken = this.configService.get<string>(
      "SERVICE_INTERNAL_TOKEN"
    );
  }

  async sendBookingCancelledNotification(
    recipients: BookingCancellationRecipient[],
    courtName: string,
    centerName: string,
    reason: BookingCancelReason
  ): Promise<void> {
    if (recipients.length === 0) return;

    if (!this.serviceUrl || !this.serviceToken) {
      this.logger.warn(
        "Notification service not configured (NOTIFICATION_SERVICE_URL / SERVICE_INTERNAL_TOKEN); skipping booking-cancelled notifications"
      );
      return;
    }

    await Promise.allSettled(
      recipients.map((recipient) =>
        this.sendOne(recipient, courtName, centerName, reason)
      )
    );
  }

  private async sendOne(
    recipient: BookingCancellationRecipient,
    courtName: string,
    centerName: string,
    reason: string
  ): Promise<void> {
    const dateStr = recipient.date.toISOString().split("T")[0];
    const title = `Booking cancelled - ${courtName}`;
    const message =
      `Your booking on ${dateStr} from ${recipient.startTime} to ${recipient.endTime} ` +
      `at ${centerName} (${courtName}) was cancelled because ${reason}. Please rebook a different slot.`;

    // 1. Send In-App Notification
    try {
      const response = await fetch(`${this.serviceUrl}/send`, {
        method: "POST",
        headers: {
          "x-internal-service-token": this.serviceToken!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userIds: [recipient.playerId],
          title,
          message,
        }),
      });

      if (!response.ok) {
        this.logger.error(`In-app cancellation notification failed for player ${recipient.playerId}`);
      }
    } catch (err) {
      this.logger.error(`In-app cancellation notification error: ${err}`);
    }

    // 2. Send Email Notification
    if (recipient.playerEmail) {
      try {
        const response = await fetch(`${this.serviceUrl}/email/send`, {
          method: "POST",
          headers: {
            "x-internal-service-token": this.serviceToken!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: recipient.playerEmail,
            subject: `Cancelled: Your booking at ${centerName}`,
            template: 'booking_cancelled',
            context: {
              playerName: recipient.playerName || 'Player',
              centerName,
              courtName,
              date: dateStr,
              startTime: recipient.startTime,
              endTime: recipient.endTime,
              reason,
              bookingDetailsHtml: recipient.bookingDetailsHtml || `<li><strong>${courtName}:</strong> ${recipient.startTime} - ${recipient.endTime}</li>`,
            },
          }),
        });

        if (!response.ok) {
          const body = await response.text().catch(() => "");
          this.logger.error(`Email cancellation notification failed for player ${recipient.playerId}: ${body}`);
        }
      } catch (err) {
        this.logger.error(`Email cancellation notification error: ${err}`);
      }
    }
  }

  async sendBookingConfirmedNotification(
    recipient: { 
      playerId: string; 
      playerEmail?: string; 
      playerName?: string; 
      bookingId: string; 
      date: Date; 
      startTime: string; 
      endTime: string;
      bookingDetailsHtml?: string;
    },
    courtName: string,
    centerName: string,
  ): Promise<void> {
    if (!this.serviceUrl || !this.serviceToken) {
      this.logger.warn(
        "Notification service not configured (NOTIFICATION_SERVICE_URL / SERVICE_INTERNAL_TOKEN); skipping booking-confirmed notification"
      );
      return;
    }

    const dateStr = recipient.date.toISOString().split("T")[0];
    const title = `Booking confirmed - ${courtName}`;
    const message = `Your booking on ${dateStr} from ${recipient.startTime} to ${recipient.endTime} at ${centerName} (${courtName}) has been confirmed. Enjoy your game!`;

    // 1. Send In-App Notification
    try {
      const response = await fetch(`${this.serviceUrl}/send`, {
        method: "POST",
        headers: {
          "x-internal-service-token": this.serviceToken!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userIds: [recipient.playerId],
          title,
          message,
        }),
      });

      if (!response.ok) {
        this.logger.error(`In-app notification failed: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      this.logger.error(`In-app notification error: ${err}`);
    }

    // 2. Send Email Notification (if email provided)
    if (recipient.playerEmail) {
      try {
        const response = await fetch(`${this.serviceUrl}/email/send`, {
          method: "POST",
          headers: {
            "x-internal-service-token": this.serviceToken!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: recipient.playerEmail,
            subject: `Confirmed: Your booking at ${centerName}`,
            template: 'booking_confirmed',
            context: {
              playerName: recipient.playerName || 'Player',
              centerName,
              courtName,
              date: dateStr,
              startTime: recipient.startTime,
              endTime: recipient.endTime,
              bookingDetailsHtml: recipient.bookingDetailsHtml || `<li><strong>${courtName}:</strong> ${recipient.startTime} - ${recipient.endTime}</li>`,
            },
          }),
        });

        if (!response.ok) {
          const body = await response.text().catch(() => "");
          this.logger.error(`Email notification failed: ${response.status} ${body}`);
        }
      } catch (err) {
        this.logger.error(`Email notification error: ${err}`);
      }
    }
  }
}
