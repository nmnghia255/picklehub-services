import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../notification/notification.service';
import { SOCIAL_WAITLIST_PROMOTED_EVENT } from './social.events';
import type { SocialWaitlistPromotedEvent } from './social.events';

@Injectable()
export class SocialWaitlistListener {
  private readonly logger = new Logger(SocialWaitlistListener.name);

  constructor(private readonly notificationService: NotificationService) {}

  @OnEvent(SOCIAL_WAITLIST_PROMOTED_EVENT, { async: true })
  async handlePromoted(payload: SocialWaitlistPromotedEvent): Promise<void> {
    // Previously this fired a raw `fetch` POST to
    // `/internal/notifications/social/waitlist-promoted` — an endpoint that
    // never existed on notification-service. Every promotion silently 404'd.
    // Re-route through the same in-app notification path the kick flow uses
    // (`POST /notifications/send`), which is the only mechanism notification-
    // service actually exposes today.
    const message =
      payload.message ??
      'A spot just opened up! You have been moved to the official participant list.';

    try {
      await this.notificationService.sendInAppNotification(
        [payload.userId],
        'You are in!',
        message,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to deliver waitlist-promoted notification to ${payload.userId} for social ${payload.socialId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
