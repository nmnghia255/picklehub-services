import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service.js';
import { NotificationController } from './notification.controller.js';
import { PrismaService } from '../prisma.service.js';
import { PushModule } from '../push/push.module.js';

@Module({
  imports: [PushModule],
  controllers: [NotificationController],
  providers: [NotificationService, PrismaService],
})
export class NotificationModule {}