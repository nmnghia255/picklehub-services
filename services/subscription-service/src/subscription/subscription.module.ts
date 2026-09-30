import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionInternalController, VnpayController } from './subscription-internal.controller';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { InternalGuard } from '../guards/internal.guard';
import { SubscriptionGuard } from '../guards/subscription.guard';

@Module({
  controllers: [
    SubscriptionController,
    VnpayController,
    SubscriptionInternalController,
  ],
  providers: [
    SubscriptionService,
    PrismaService,
    JwtAuthGuard,
    InternalGuard,
    SubscriptionGuard,
  ],
  exports: [SubscriptionService, SubscriptionGuard],
})
export class SubscriptionModule {}
