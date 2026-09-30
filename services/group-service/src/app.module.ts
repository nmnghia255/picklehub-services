import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { GroupModule } from './group/group.module';
import { InvitationModule } from './invitation/invitation.module';
import { PrismaService } from './prisma.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FinanceModule } from './finance/finance.module';
import { BullModule } from '@nestjs/bullmq';
import { CourtBookingModule } from './court-booking/court-booking.module';
import { EquipmentModule } from './equipment/equipment.module';

import { APP_GUARD } from '@nestjs/core';
import { UserSubscriptionGuard } from './guards/user-subscription.guard';
import { GroupOwnerSubscriptionGuard } from './guards/group-owner-subscription.guard';
import { GroupArchiveGuard } from './guards/group-archive.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    GroupModule,
    FinanceModule,
    InvitationModule,
    CourtBookingModule,
    EquipmentModule,
  ],
  controllers: [AppController],
  providers: [
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: UserSubscriptionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: GroupOwnerSubscriptionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: GroupArchiveGuard,
    },
  ],
})
export class AppModule { }
