import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CancellationTierDto {
  @ApiProperty({
    example: 2,
    description:
      'Minimum whole days before booking start time the player must cancel ' +
      'to earn this refund percentage. Must be >= 1.',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  minDaysBeforeStart!: number;

  @ApiProperty({
    example: 100,
    description: 'Percentage of totalPrice refunded as preservation credit (0-100).',
    minimum: 0,
    maximum: 100,
  })
  @IsInt()
  @Min(0)
  @Max(100)
  refundPercent!: number;
}

export class UpdateCancellationPolicyDto {
  @ApiProperty({
    example: true,
    description:
      'Whether players are allowed to self-cancel a CONFIRMED booking and earn preservation credit.',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  allowCancellation?: boolean;

  @ApiProperty({
    type: [CancellationTierDto],
    description:
      'Ordered list of refund tiers. Each tier applies when the player cancels ' +
      'at least minDaysBeforeStart whole days before the booking start time. ' +
      'The highest-threshold qualifying tier wins; cancellations below the lowest ' +
      'tier earn 0% credit. Pass an empty array to disable all refunds.',
    example: [
      { minDaysBeforeStart: 2, refundPercent: 100 },
      { minDaysBeforeStart: 1, refundPercent: 75 },
    ],
    required: false,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CancellationTierDto)
  @IsOptional()
  tiers?: CancellationTierDto[];
}
