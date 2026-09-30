import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class FriendClient {
  private readonly logger = new Logger(FriendClient.name);
  private readonly internalHeader = 'x-internal-token';

  private get friendServiceUrl() {
    return process.env.FRIEND_SERVICE_URL ?? 'http://localhost:8010';
  }

  private get friendInternalToken() {
    return process.env.SERVICE_INTERNAL_TOKEN ?? '';
  }

  async assertFriends(userId: string, targetId: string) {
    const response = await axios.get(
      `${this.friendServiceUrl}/internal/friends/check/${userId}/${targetId}`,
      {
        headers: { [this.internalHeader]: this.friendInternalToken },
        validateStatus: () => true,
      },
    );

    if (response.status === 200 && response.data?.areFriends === true) {
      return;
    }

    this.logger.warn(
      `friend-service denied direct chat userId=${userId} targetId=${targetId} status=${response.status}`,
    );
    throw new ForbiddenException('Direct messages are only available between friends');
  }
}
