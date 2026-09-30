import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ChatClient {
  private readonly logger = new Logger(ChatClient.name);

  private get chatServiceUrl() {
    return process.env.CHAT_SERVICE_URL ?? 'http://chat-service:8029';
  }

  private get chatInternalToken() {
    return process.env.SERVICE_INTERNAL_TOKEN ?? '';
  }

  private get headers() {
    return { 'x-internal-token': this.chatInternalToken };
  }

  /**
   * Fire-and-forget: syncs the group chat participant list.
   * Passes the full current member list; chat-service will add new members
   * and soft-delete any participant no longer in the list.
   */
  syncGroupChat(groupId: string, memberIds: string[]): void {
    axios
      .post(
        `${this.chatServiceUrl}/api/chats/internal/groups/${groupId}/sync`,
        { memberIds },
        { headers: this.headers, timeout: 5000 },
      )
      .catch((error: unknown) => {
        this.logger.warn(
          `Failed to sync group chat groupId=${groupId}: ${(error as Error)?.message ?? error}`,
        );
      });
  }
}
