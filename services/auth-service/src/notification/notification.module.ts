import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { InternalNotificationsController } from '../internal/notifications.controller';

@Module({
    imports: [ConfigModule],
    providers: [NotificationService],
    controllers: [InternalNotificationsController],
    exports: [NotificationService],
})
export class NotificationModule { }
