import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { EmailModule } from './email/email.module.js';
import { NotificationModule } from './in-app/notification.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // ScheduleModule enables the @Cron() decorator used by PushReceiptPoller
    ScheduleModule.forRoot(),
    EmailModule,
    // NotificationModule already imports PushModule internally —
    // do NOT import PushModule here again or PushReceiptPoller would be
    // instantiated twice and the cron job would fire twice per interval.
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

