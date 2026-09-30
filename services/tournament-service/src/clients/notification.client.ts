import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * Client for communicating with notification-service.
 * Dispatches email notifications to internal endpoints.
 */
@Injectable()
export class NotificationClient {
  private readonly logger = new Logger(NotificationClient.name);

  private get baseUrl(): string {
    return process.env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:8002';
  }

  private get internalToken(): string {
    return process.env.SERVICE_INTERNAL_TOKEN ?? 'your-super-secret-internal-service-token-change-this-in-production';
  }

  private get headers() {
    return {
      'x-internal-service-token': this.internalToken,
      'Content-Type': 'application/json',
    };
  }

  private get userServiceUrl(): string {
    return process.env.USER_SERVICE_URL ?? 'http://localhost:8006';
  }

  /**
   * Fetches user email from user-service using user ID.
   */
  async getUserEmail(userId: string): Promise<string | null> {
    try {
      const res = await axios.get(
        `${this.userServiceUrl}/api/users/${userId}`,
        {
          timeout: 1500,
          validateStatus: () => true,
        }
      );

      if (res.status === 200 && res.data?.success && res.data?.data?.email) {
        return res.data.data.email as string;
      }
      this.logger.warn(`Failed to fetch user email for ID ${userId}: status=${res.status}`);
    } catch (e) {
      this.logger.error(`Error fetching user email for ID ${userId}: ${e}`);
    }
    // Fallback logic for seed/test accounts if user-service is not reachable or hasn't created the profile
    const mockEmailMap: Record<string, string> = {
      '11111111-1111-4111-8111-111111111111': 'seed-user@picklehub.com',
      '22222222-2222-4222-8222-222222222222': 'seed-owner@picklehub.com',
      'f0000000-f000-4000-8000-000000000000': 'seed-referee@picklehub.com',
      '33333333-3333-4333-8333-333333333333': 'seed-player-1@picklehub.com',
      '44444444-4444-4444-8444-444444444444': 'seed-player-2@picklehub.com',
      '55555555-5555-4555-8555-555555555555': 'seed-player-3@picklehub.com',
      'b0000001-b000-4000-8000-000000000000': 'seed-booker-01@picklehub.com',
      'b0000002-b000-4000-8000-000000000000': 'seed-booker-02@picklehub.com',
      'b0000003-b000-4000-8000-000000000000': 'seed-booker-03@picklehub.com',
    };
    if (mockEmailMap[userId]) {
      return mockEmailMap[userId];
    }
    return null;
  }

  get frontendUrl(): string {
    return process.env.FRONTEND_URL ?? 'http://localhost:3000';
  }

  /**
   * Dispatches an email notification request to the notification-service.
   * Logs error but does not throw, ensuring core service logic continues even if emails fail.
   */
  async sendEmail(to: string, template: string, context: Record<string, any>, subject?: string): Promise<boolean> {
    try {
      const payload = {
        to,
        template,
        context,
        ...(subject ? { subject } : {}),
      };

      const res = await axios.post(
        `${this.baseUrl}/api/notification/email/send`,
        payload,
        {
          headers: this.headers,
          timeout: 1500,
          validateStatus: () => true,
        },
      );

      if (res.status === 200 || res.status === 201) {
        this.logger.log(`Successfully queued email to ${to} using template ${template}`);
        return true;
      }

      this.logger.error(`notification-service send failed: status=${res.status} error=${JSON.stringify(res.data)}`);
    } catch (e) {
      this.logger.error(`Failed to send email notification to ${to}: ${e}`);
    }
    return false;
  }

  /**
   * Dispatches an in-app notification request to the notification-service.
   * Logs error but does not throw, ensuring core service logic continues even if notifications fail.
   */
  async sendInAppNotification(userIds: string[], title: string, message: string): Promise<boolean> {
    try {
      if (!userIds || userIds.length === 0) return false;

      const payload = {
        userIds,
        title,
        message,
      };

      const res = await axios.post(
        `${this.baseUrl}/api/notification/send`,
        payload,
        {
          headers: this.headers,
          timeout: 1500,
          validateStatus: () => true,
        },
      );

      if (res.status === 200 || res.status === 201) {
        this.logger.log(`Successfully sent in-app notification to ${userIds.length} users`);
        return true;
      }

      this.logger.error(`notification-service in-app send failed: status=${res.status} error=${JSON.stringify(res.data)}`);
    } catch (e) {
      this.logger.error(`Failed to send in-app notification to ${userIds.join(', ')}: ${e}`);
    }
    return false;
  }
}
