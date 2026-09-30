import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum BookingStatusQuery {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export enum TimeFilterQuery {
  PAST = 'PAST',
  FUTURE = 'FUTURE',
}

export class ListBookingsQueryDto {
  @ApiProperty({ required: false, enum: BookingStatusQuery })
  @IsOptional()
  @IsEnum(BookingStatusQuery)
  status?: BookingStatusQuery;

  @ApiProperty({ required: false, description: 'Filter by court ID' })
  @IsOptional()
  @IsString()
  courtId?: string;

  @ApiProperty({ required: false, description: 'Filter by sport center ID' })
  @IsOptional()
  @IsString()
  centerId?: string;

  @ApiProperty({ required: false, description: '@deprecated Kept for old frontend code compatibility. Consider using startDate and endDate for better filtering. If provided, this takes precedence and overrides other date filters.' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiProperty({ required: false, description: 'Filter by start date (YYYY-MM-DD). Ignored if `date` is provided.' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiProperty({ required: false, description: 'Filter by end date (YYYY-MM-DD). Ignored if `date` is provided.' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiProperty({ required: false, enum: TimeFilterQuery, description: 'Filter by past or future bookings. Can be combined with startDate and endDate. Ignored if `date` is provided.' })
  @IsOptional()
  @IsEnum(TimeFilterQuery)
  timeFilter?: TimeFilterQuery;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number;
}
