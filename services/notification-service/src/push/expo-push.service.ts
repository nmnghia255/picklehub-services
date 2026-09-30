import Expo from 'expo-server-sdk';
import type { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class ExpoPushService {
  private readonly expo: Expo;
  private readonly logger = new Logger(ExpoPushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const accessToken = this.configService.get<string>('EXPO_ACCESS_TOKEN');
    // accessToken is optional — works without it but recommended for production security.
    this.expo = new Expo(accessToken ? { accessToken } : {});
  }

  /**
   * Send a push notification to all registered devices of the given users.
   * This is fire-and-forward: errors are logged but never thrown so they
   * cannot disrupt the calling in-app notification flow.
   */
  async sendToUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    if (!userIds.length) return;

    const tokens = await this.getValidTokens(userIds);
    if (!tokens.length) {
      this.logger.debug(`No valid push tokens found for ${userIds.length} user(s) — skipping push`);
      return;
    }

    const messages: ExpoPushMessage[] = tokens.map((token) => ({
      to: token,
      sound: 'default' as const,
      title,
      body,
      data: data ?? {},
      priority: 'high' as const,
      // channelId is required on Android for Expo SDK 41+ (configured on the mobile side)
      channelId: 'default',
    }));

    // Expo SDK automatically chunks into batches of ≤100
    const chunks = this.expo.chunkPushNotifications(messages);
    const ticketEntries: Array<{ ticket: ExpoPushTicket; token: string }> = [];

    for (const chunk of chunks) {
      try {
        const chunkTickets = await this.expo.sendPushNotificationsAsync(chunk);
        chunkTickets.forEach((ticket, i) => {
          ticketEntries.push({ ticket, token: chunk[i].to as string });
        });
      } catch (err) {
        this.logger.error('Failed to deliver push notification chunk to Expo', err);
      }
    }

    // Process tickets asynchronously — do not await so we don't block the caller
    this.processTickets(ticketEntries).catch((err) =>
      this.logger.error('Failed to process push tickets', err),
    );
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async getValidTokens(userIds: string[]): Promise<string[]> {
    const rows = await this.prisma.devicePushToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true },
    });
    // Expo.isExpoPushToken validates the ExponentPushToken[...] format
    return rows.map((r) => r.token).filter((t) => Expo.isExpoPushToken(t));
  }

  private async processTickets(
    entries: Array<{ ticket: ExpoPushTicket; token: string }>,
  ): Promise<void> {
    const toSave: Array<{ ticketId: string; token: string }> = [];
    const tokensToRemove: string[] = [];

    for (const { ticket, token } of entries) {
      if (ticket.status === 'ok') {
        // Save ticket ID for receipt polling (checked by cron ~15 min later)
        toSave.push({ ticketId: ticket.id, token });
      } else {
        // ticket.status === 'error'
        this.logger.warn(`Push ticket error [token: ...${token.slice(-10)}]: ${ticket.message}`);
        const errCode = (ticket as { details?: { error?: string } }).details?.error;
        if (errCode === 'DeviceNotRegistered') {
          tokensToRemove.push(token);
        }
      }
    }

    if (toSave.length > 0) {
      await this.prisma.pushTicket.createMany({ data: toSave, skipDuplicates: true });
      this.logger.debug(`Saved ${toSave.length} push ticket(s) for receipt polling`);
    }

    if (tokensToRemove.length > 0) {
      await this.prisma.devicePushToken.deleteMany({ where: { token: { in: tokensToRemove } } });
      this.logger.warn(`Removed ${tokensToRemove.length} DeviceNotRegistered token(s) from tickets`);
    }
  }
}
