import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';

export type SocialAccess = {
  canAccess: boolean;
  role: 'HOST' | 'PARTICIPANT';
  social: {
    id: string;
    title: string;
    status: string;
    creatorId: string;
    joinedCount?: number;
  };
};

@Injectable()
export class EventClient {
  private readonly internalServiceHeader = 'x-internal-service-token';

  private get eventServiceUrl() {
    return process.env.EVENT_SERVICE_URL ?? 'http://localhost:8004';
  }

  private get internalToken() {
    return process.env.SERVICE_INTERNAL_TOKEN ?? '';
  }

  async assertSocialAccess(socialId: string, userId: string): Promise<SocialAccess> {
    const response = await axios.get(
      `${this.eventServiceUrl}/socials/internal/${socialId}/access/${userId}`,
      {
        headers: { [this.internalServiceHeader]: this.internalToken },
        validateStatus: () => true,
      },
    );

    if (response.status === 404) throw new NotFoundException('Social not found');
    if (response.status >= 400 || response.data?.canAccess !== true) {
      throw new ForbiddenException('You cannot access this social conversation');
    }

    return response.data as SocialAccess;
  }
}
