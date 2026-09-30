import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
}

@Injectable()
export class AuthIntegrationService {
  private readonly logger = new Logger(AuthIntegrationService.name);

  constructor(private readonly configService: ConfigService) {}

  async getUsersProfiles(userIds: string[]): Promise<Map<string, UserProfile>> {
    if (!userIds || userIds.length === 0) return new Map();
    
    const uniqueIds = Array.from(new Set(userIds));
    const authUrl = this.configService.get<string>('AUTH_SERVICE_URL');
    const token = this.configService.get<string>('SERVICE_INTERNAL_TOKEN'); // Uses the shared service token to call auth-service

    if (!authUrl || !token) {
      this.logger.error('AUTH_SERVICE_URL or SERVICE_INTERNAL_TOKEN is not configured');
      return new Map();
    }

    try {
      const response = await fetch(`${authUrl}/api/auth/internal/users/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': token,
        },
        body: JSON.stringify({ userIds: uniqueIds }),
      });

      if (!response.ok) {
        this.logger.error(`Failed to fetch user profiles: ${response.status} ${response.statusText}`);
        return new Map();
      }

      const users: UserProfile[] = await response.json();
      const userMap = new Map<string, UserProfile>();
      for (const u of users) {
        userMap.set(u.id, u);
      }
      return userMap;
    } catch (error: any) {
      this.logger.error(`Error fetching user profiles: ${error.message}`);
      return new Map();
    }
  }

  async enrichWithLearnerProfiles<T extends { learnerId: string }>(items: T[]): Promise<(T & { learnerProfile: UserProfile | null })[]> {
    if (!items || items.length === 0) return items as any;
    const learnerIds = items.map((i) => i.learnerId).filter(Boolean);
    const profiles = await this.getUsersProfiles(learnerIds);
    return items.map((item) => ({
      ...item,
      learnerProfile: item.learnerId ? profiles.get(item.learnerId) || null : null,
    }));
  }

  async enrichSingleWithLearnerProfile<T extends { learnerId: string }>(item: T): Promise<T & { learnerProfile: UserProfile | null }> {
    if (!item) return item as any;
    const enriched = await this.enrichWithLearnerProfiles([item]);
    return enriched[0];
  }
}
