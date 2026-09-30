import { Module } from '@nestjs/common';
import { CoachRecommendationController } from './coach-recommendation.controller';
import { CoachRecommendationService } from './coach-recommendation.service';
import { PrismaService } from '../prisma.service';
import { NotificationIntegrationModule } from '../notification-integration/notification-integration.module';
import { AuthIntegrationModule } from '../auth-integration/auth-integration.module';

@Module({
  imports: [NotificationIntegrationModule, AuthIntegrationModule],
  controllers: [CoachRecommendationController],
  providers: [CoachRecommendationService, PrismaService],
})
export class CoachRecommendationModule {}
