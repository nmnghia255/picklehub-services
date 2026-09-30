import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class CoachRevenueSummaryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year?: number;

  @IsOptional()
  @IsIn(['month', 'quarter', 'year'])
  period?: 'month' | 'quarter' | 'year' = 'month';
}