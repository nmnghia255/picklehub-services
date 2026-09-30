import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class UserClient {
  private readonly logger = new Logger(UserClient.name);

  private get baseUrl(): string {
    return process.env.USER_SERVICE_URL ?? 'http://localhost:8006';
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

  async getUserProfile(userId: string): Promise<any | null> {
    try {
      const res = await axios.get(`${this.baseUrl}/api/users/${userId}`, {
        headers: this.headers,
        validateStatus: () => true,
      });

      if (res.status === 200 && res.data?.success && res.data?.data) {
        return res.data.data;
      }
      this.logger.warn(`Failed to fetch user profile for ID ${userId}: status=${res.status}`);
    } catch (e) {
      this.logger.error(`Error fetching user profile for ID ${userId}: ${e}`);
    }
    return null;
  }

  async getBatchProfiles(userIds: string[]): Promise<any[]> {
    try {
      const res = await axios.post(`${this.baseUrl}/api/users/internal/batch`, { userIds }, {
        headers: this.headers,
        validateStatus: () => true,
      });

      if (res.status === 201 && Array.isArray(res.data)) {
        return res.data;
      }
      this.logger.warn(`Failed to fetch batch user profiles: status=${res.status}`);
    } catch (e) {
      this.logger.error(`Error fetching batch user profiles: ${e}`);
    }
    return [];
  }

  async searchUsers(query: string, page = 1, limit = 10): Promise<any> {
    const authServiceUrl = process.env.AUTH_SERVICE_URL ?? 'http://localhost:8001';
    const authToken = process.env.SERVICE_INTERNAL_TOKEN ?? '';
    try {
      const res = await axios.get(`${authServiceUrl}/api/auth/internal/users`, {
        params: { q: query, page, limit },
        headers: {
          'x-internal-token': authToken,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      });

      if (res.status === 200) {
        return res.data;
      }
      this.logger.warn(`Failed to search users in auth service: status=${res.status}`);
    } catch (e) {
      this.logger.error(`Error searching users in auth service: ${e}`);
    }
    return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
  }
}
