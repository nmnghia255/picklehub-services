import { Module } from '@nestjs/common';
import { PushController } from './push.controller.js';
import { PushService } from './push.service.js';
import { ExpoPushService } from './expo-push.service.js';
import { PushReceiptPoller } from './push-receipt.poller.js';
import { PrismaService } from '../prisma.service.js';

@Module({
  controllers: [PushController],
  providers: [PushService, ExpoPushService, PushReceiptPoller, PrismaService],
  exports: [ExpoPushService],
})
export class PushModule {}
