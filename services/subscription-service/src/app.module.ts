import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { PlanModule } from './plan/plan.module';
import { SubscriptionModule } from './subscription/subscription.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PlanModule,
    SubscriptionModule,
  ],
  controllers: [AppController],
  providers: [PrismaService],
})
export class AppModule {}
