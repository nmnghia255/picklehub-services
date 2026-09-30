import Expo from 'expo-server-sdk';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service.js';

/**
 * Background job that polls Expo push receipts every 30 minutes.
 *
 * Flow:
 * 1. Fetch PushTicket rows older than 15 min that have not been checked yet.
 * 2. Call Expo Push API to retrieve receipts for those ticket IDs.
 * 3. For any receipt with error=DeviceNotRegistered, delete that device token so
 *    we stop sending to that device.
 * 4. Mark tickets as checked and purge tickets older than 24h.
 */
@Injectable()
export class PushReceiptPoller {
  private readonly expo: Expo;
  private readonly logger = new Logger(PushReceiptPoller.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const accessToken = this.configService.get<string>('EXPO_ACCESS_TOKEN');
    this.expo = new Expo(accessToken ? { accessToken } : {});
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async pollReceipts(): Promise<void> {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    // Max 1000 IDs per Expo getReceipts request
    const tickets = await this.prisma.pushTicket.findMany({
      where: { checkedAt: null, createdAt: { lt: fifteenMinutesAgo } },
      take: 1000,
    });

    if (!tickets.length) {
      this.logger.debug('No pending push receipts to poll');
      return;
    }

    this.logger.log(`Polling ${tickets.length} push receipt(s)`);

    const receiptIds = tickets.map((t) => t.ticketId);
    const chunks = this.expo.chunkPushNotificationReceiptIds(receiptIds);
    const tokensToRemove: string[] = [];

    for (const chunk of chunks) {
      try {
        const receipts = await this.expo.getPushNotificationReceiptsAsync(chunk);

        for (const [receiptId, receipt] of Object.entries(receipts)) {
          if (receipt.status === 'error') {
            const errCode = receipt.details?.error;
            this.logger.warn(`Receipt error [${receiptId}]: ${errCode} — ${receipt.message}`);

            if (errCode === 'DeviceNotRegistered') {
              const matched = tickets.find((t) => t.ticketId === receiptId);
              if (matched) tokensToRemove.push(matched.token);
            }
          }
        }
      } catch (err) {
        this.logger.error('Failed to fetch push receipt chunk from Expo', err);
      }
    }

    // Mark all fetched tickets as checked
    await this.prisma.pushTicket.updateMany({
      where: { ticketId: { in: receiptIds } },
      data: { checkedAt: new Date() },
    });

    // Remove invalid device tokens detected via receipts
    if (tokensToRemove.length > 0) {
      await this.prisma.devicePushToken.deleteMany({ where: { token: { in: tokensToRemove } } });
      this.logger.warn(`Removed ${tokensToRemove.length} DeviceNotRegistered token(s) from receipts`);
    }

    // Purge tickets checked more than 24 hours ago to keep the table lean
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const purged = await this.prisma.pushTicket.deleteMany({
      where: { checkedAt: { lt: oneDayAgo } },
    });
    if (purged.count > 0) {
      this.logger.log(`Purged ${purged.count} old push ticket(s)`);
    }
  }
}
