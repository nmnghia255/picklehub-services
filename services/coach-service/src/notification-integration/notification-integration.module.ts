import { Module } from '@nestjs/common';
import { NotificationIntegrationService } from './notification-integration.service';

@Module({
  providers: [NotificationIntegrationService],
  exports: [NotificationIntegrationService],
})
export class NotificationIntegrationModule {}
