import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

type SendNotificationPayload = {
  userIds: string[];
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class NotificationClient {
  private readonly logger = new Logger(NotificationClient.name);
  private readonly internalServiceHeader = 'x-internal-service-token';

  private get notificationServiceUrl() {
    return process.env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:8002/api/notification';
  }

  private get notificationServiceToken() {
    return process.env.SERVICE_INTERNAL_TOKEN ?? '';
  }

  async sendMany(payload: SendNotificationPayload) {
    if (payload.userIds.length === 0) return;

    const response = await axios.post(`${this.notificationServiceUrl}/send`, payload, {
      headers: { [this.internalServiceHeader]: this.notificationServiceToken },
      validateStatus: () => true,
    });

    if (response.status >= 400) {
      this.logger.warn(`notification-service returned ${response.status}`);
    }
  }
}
