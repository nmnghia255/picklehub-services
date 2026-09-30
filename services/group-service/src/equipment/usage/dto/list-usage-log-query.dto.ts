import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export enum UsageLogSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListUsageLogQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number (1-based).',
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    example: 20,
    description: 'Number of items per page.',
    default: 20,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({
    example: '2026-06-01',
    description:
      'ISO date string. Only return logs where `usedAt >= fromDate`. ' +
      'Useful for filtering by month or date range on the frontend calendar view.',
  })
  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @ApiPropertyOptional({
    example: '2026-06-30',
    description:
      'ISO date string. Only return logs where `usedAt <= toDate`. ' +
      'Combine with `fromDate` to query a specific period (e.g. a month or week).',
  })
  @IsDateString()
  @IsOptional()
  toDate?: string;

  @ApiPropertyOptional({
    enum: UsageLogSortOrder,
    example: UsageLogSortOrder.DESC,
    description:
      'Sort direction by `usedAt`. `desc` = newest first (default). `asc` = oldest first.',
    default: UsageLogSortOrder.DESC,
  })
  @IsEnum(UsageLogSortOrder)
  @IsOptional()
  sortOrder?: UsageLogSortOrder;
}
