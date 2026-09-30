import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaService } from './prisma.service';
import { CoachProfileModule } from './coach-profile/coach-profile.module';
import { CoachCertificationModule } from './coach-certification/coach-certification.module';
import { CoachClassModule } from './coach-class/coach-class.module';
import { ClassScheduleModule } from './class-schedule/class-schedule.module';
import { ClassEnrollmentModule } from './class-enrollment/class-enrollment.module';
import { PrivateBookingModule } from './private-booking/private-booking.module';
import { AuthIntegrationModule } from './auth-integration/auth-integration.module';
import { SportCenterIntegrationModule } from './sport-center-integration/sport-center-integration.module';
import { CoachLearnerModule } from './coach-learner/coach-learner.module';
import { LearningScheduleModule } from './learning-schedule/learning-schedule.module';
import { CoachScheduleModule } from './coach-schedule/coach-schedule.module';
import { CoachRevenueModule } from './coach-revenue/coach-revenue.module';
import { CoachReviewModule } from './coach-review/coach-review.module';
import { CoachRecommendationModule } from './coach-recommendation/coach-recommendation.module';
import { APP_GUARD } from '@nestjs/core';
import { SubscriptionGuard } from './guards/subscription.guard';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthIntegrationModule,
    SportCenterIntegrationModule,
    CoachProfileModule,
    CoachCertificationModule,
    CoachClassModule,
    ClassScheduleModule,
    ClassEnrollmentModule,
    PrivateBookingModule,
    CoachLearnerModule,
    LearningScheduleModule,
    CoachScheduleModule,
    CoachRevenueModule,
    CoachReviewModule,
    CoachRecommendationModule,
  ],
  controllers: [AppController],
  providers: [
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: SubscriptionGuard,
    },
  ],
})
export class AppModule {}
