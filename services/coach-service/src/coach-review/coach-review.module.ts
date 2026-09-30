import { Module } from '@nestjs/common';
import { CoachReviewController } from './coach-review.controller';
import { CoachReviewService } from './coach-review.service';
import { PrismaService } from '../prisma.service';
import { AuthIntegrationModule } from '../auth-integration/auth-integration.module';

@Module({
  imports: [AuthIntegrationModule],
  controllers: [CoachReviewController],
  providers: [CoachReviewService, PrismaService],
})
export class CoachReviewModule {}
