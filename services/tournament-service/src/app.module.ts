import { Module } from '@nestjs/common';
import { TournamentsModule } from './tournaments/tournaments.module';
import { PrismaModule } from './prisma/prisma.module';
import { AppController } from './app.controller';
import { EventsModule } from './events/events.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { TeamsModule } from './teams/teams.module';
import { FinanceModule } from './finance/finance.module';
import { CheckInsModule } from './check-ins/check-ins.module';
import { RefereesModule } from './referees/referees.module';
import { SponsorsModule } from './sponsors/sponsors.module';
import { PrizesModule } from './prizes/prizes.module';
import { ClientsModule } from './clients/clients.module';
import { CommonModule } from './common/common.module';
import { SeedingModule } from './seeding/seeding.module';
import { BracketModule } from './brackets/bracket.module';
import { CourtsModule } from './courts/courts.module';
import { BookingsModule } from './bookings/bookings.module';
import { RunModule } from './run/run.module';
import { AdvancementModule } from './advancement/advancement.module';
import { GroupStageModule } from './group-stage/group-stage.module';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD } from '@nestjs/core';
import { SubscriptionGuard } from './guards/subscription.guard';


@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    }),
    PrismaModule,
    ClientsModule,
    CommonModule,
    TournamentsModule,
    SeedingModule,
    BracketModule,
    CourtsModule,
    BookingsModule,
    AdvancementModule,
    GroupStageModule,
    RunModule,
    EventsModule,
    RegistrationsModule,
    TeamsModule,
    FinanceModule,
    CheckInsModule,
    RefereesModule,
    SponsorsModule,
    PrizesModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SubscriptionGuard,
    },
  ],
})
export class AppModule {}
