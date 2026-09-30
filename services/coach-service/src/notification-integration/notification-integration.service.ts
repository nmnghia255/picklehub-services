import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationIntegrationService {
  private readonly logger = new Logger(NotificationIntegrationService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendNotification(userIds: string[], title: string, message: string, metadata?: Record<string, any>): Promise<boolean> {
    if (!userIds || userIds.length === 0) return false;

    // Use NOTIFICATION_SERVICE_URL or fallback to docker service name
    const notificationUrl = this.configService.get<string>('NOTIFICATION_SERVICE_URL') || 'http://notification-service:8010';
    // Internal token for safe service-to-service communication
    const token = this.configService.get<string>('SERVICE_INTERNAL_TOKEN') || '';

    try {
      const response = await fetch(`${notificationUrl}/api/notifications/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service-token': token,
        },
        body: JSON.stringify({ userIds, title, message, metadata: metadata || null }),
      });

      if (!response.ok) {
        this.logger.error(`Failed to send notification: ${response.status} ${response.statusText}`);
        return false;
      }

      return true;
    } catch (error: any) {
      this.logger.error(`Error sending notification: ${error.message}`);
      return false;
    }
  }
}
