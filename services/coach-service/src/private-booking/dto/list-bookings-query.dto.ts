import { IsDateString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum BookingStatusFilter {
  PENDING_CONFIRMATION = 'PENDING_CONFIRMATION',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export class ListBookingsQueryDto {
  @ApiPropertyOptional({
    enum: BookingStatusFilter,
    example: 'PENDING_CONFIRMATION',
    description: 'Filter by booking status.',
  })
  @IsOptional()
  @IsEnum(BookingStatusFilter)
  status?: BookingStatusFilter;

  @ApiPropertyOptional({
    example: '2026-07-01',
    description: 'Return only bookings whose `sessionAt` is on or after this date (ISO 8601, UTC).',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-07-31',
    description: 'Return only bookings whose `sessionAt` is on or before this date (ISO 8601, UTC).',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ example: 1, description: 'Page number (1-indexed).', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, description: 'Number of results per page.', default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;
}
