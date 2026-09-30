import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import axios from 'axios';

export type UserProfile = {
  id: string;
  name: string | null;
  email: string;
  role?: string;
};

@Injectable()
export class AuthClient {
  private readonly logger = new Logger(AuthClient.name);
  private readonly internalHeader = 'x-internal-token';

  private get authServiceUrl() {
    return process.env.AUTH_SERVICE_URL ?? 'http://localhost:8001';
  }

  private get authInternalToken() {
    return process.env.SERVICE_INTERNAL_TOKEN ?? '';
  }

  async getUser(userId: string): Promise<UserProfile> {
    const response = await axios.get(
      `${this.authServiceUrl}/api/auth/internal/users/${userId}`,
      {
        headers: { [this.internalHeader]: this.authInternalToken },
        validateStatus: () => true,
      },
    );

    if (response.status === 404) {
      throw new NotFoundException('User not found');
    }

    if (response.status >= 400) {
      this.logger.warn(`auth-service returned ${response.status} for ${userId}`);
      throw new NotFoundException('User not found');
    }

    return response.data as UserProfile;
  }

  async getUsers(userIds: string[]): Promise<Map<string, UserProfile>> {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueIds.length === 0) return new Map();

    const response = await axios.post(
      `${this.authServiceUrl}/api/auth/internal/users/batch`,
      { userIds: uniqueIds },
      {
        headers: { [this.internalHeader]: this.authInternalToken },
        validateStatus: () => true,
      },
    );

    if (response.status >= 400) {
      this.logger.warn(`auth-service batch returned ${response.status}`);
      return new Map();
    }

    const users = Array.isArray(response.data) ? response.data : [];
    return new Map((users as UserProfile[]).map((user) => [user.id, user]));
  }
}
