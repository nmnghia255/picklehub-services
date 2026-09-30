import { Module } from '@nestjs/common';
import { PlanController } from './plan.controller';
import { PlanService } from './plan.service';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { OptionalJwtAuthGuard } from '../guards/optional-jwt-auth.guard';

@Module({
  controllers: [PlanController],
  providers: [PlanService, PrismaService, JwtAuthGuard, AdminRoleGuard, OptionalJwtAuthGuard],
  exports: [PlanService],
})
export class PlanModule {}
