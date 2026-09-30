import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { RegisterTokenDto } from './dto/register-token.dto.js';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Register (or update) a device push token for a user.
   * Upsert on the unique `token` field so re-registering is always safe.
   */
  async registerToken(userId: string, dto: RegisterTokenDto) {
    const record = await this.prisma.devicePushToken.upsert({
      where: { token: dto.token },
      update: { userId, platform: dto.platform ?? null },
      create: { userId, token: dto.token, platform: dto.platform ?? null },
    });
    this.logger.log(`Push token registered for user ${userId} [${dto.platform ?? 'unknown'}]`);
    return record;
  }

  /**
   * Remove a specific push token.
   * Scoped to userId so a user can only remove their own tokens.
   */
  async unregisterToken(userId: string, token: string) {
    const result = await this.prisma.devicePushToken.deleteMany({
      where: { token, userId },
    });
    this.logger.log(`Push token unregistered for user ${userId} (deleted: ${result.count})`);
    return { deleted: result.count };
  }

  /**
   * List all active push tokens for a user.
   */
  async getMyTokens(userId: string) {
    return this.prisma.devicePushToken.findMany({
      where: { userId },
      select: { token: true, platform: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
