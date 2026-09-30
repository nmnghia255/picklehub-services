import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PlanType, BillingCycle } from '@prisma/client';

export class ListPlansQueryDto {
  @ApiPropertyOptional({
    enum: PlanType,
    description: 'Filter plans by type.',
    example: PlanType.GROUP_OWNER,
  })
  @IsOptional()
  @IsEnum(PlanType)
  type?: PlanType;

  @ApiPropertyOptional({
    enum: BillingCycle,
    description: 'Filter plans by billing cycle.',
    example: BillingCycle.MONTHLY,
  })
  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;
}
