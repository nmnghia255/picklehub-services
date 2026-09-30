import { Module } from '@nestjs/common';
import { AuthIntegrationModule } from '../auth-integration/auth-integration.module';
import { PrismaService } from '../prisma.service';
import { CoachRevenueController } from './coach-revenue.controller';
import { CoachRevenueService } from './coach-revenue.service';

@Module({
  imports: [AuthIntegrationModule],
  controllers: [CoachRevenueController],
  providers: [CoachRevenueService, PrismaService],
})
export class CoachRevenueModule {}