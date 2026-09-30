import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SocialModule } from './social/social.module';
import { SessionModule } from './social/play-session/session.module';
import { SocialParticipantModule } from './social/participant/social-participant.module';
import { PlaySessionLifecycleModule } from './social/play-session/lifecycle/play-session-lifecycle.module';
import { PrismaModule } from './prisma.module';
import { PlaySessionParticipantModule } from './social/play-session/participant/play-session-participant.module';
import { MatchBatchModule } from './social/play-session/match-batch/match-batch.module';
import { FinanceModule } from './social/finance/expense/finance.module';
import { APP_GUARD } from '@nestjs/core';
import { SubscriptionGuard } from './guards/subscription.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    SocialModule,
    SessionModule,
    SocialParticipantModule,
    PlaySessionLifecycleModule,
    PlaySessionParticipantModule,
    MatchBatchModule,
    FinanceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: SubscriptionGuard,
    },
  ],
})
export class AppModule {}
