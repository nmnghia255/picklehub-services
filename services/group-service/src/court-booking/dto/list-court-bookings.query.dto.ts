import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ListCourtBookingsQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-indexed).', example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page.', example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by booking date — from (inclusive). ISO date string `YYYY-MM-DD`.',
    example: '2026-07-01',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by booking date — to (inclusive). ISO date string `YYYY-MM-DD`.',
    example: '2026-07-31',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by activity link status. `true` = linked to an activity, `false` = not linked.',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  linked?: boolean;

  @ApiPropertyOptional({
    description: 'Exclude past bookings (where date is before today).',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  excludePast?: boolean;
}
