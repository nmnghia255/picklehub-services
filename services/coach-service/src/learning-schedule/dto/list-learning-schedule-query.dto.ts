import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class ListLearningScheduleQueryDto {
  @ApiPropertyOptional({ enum: ['all', 'class', 'booking'], default: 'all' })
  @IsOptional()
  @IsIn(['all', 'class', 'booking'])
  kind?: 'all' | 'class' | 'booking' = 'all';

  @ApiPropertyOptional({
    enum: ['all', 'upcoming', 'live', 'past', 'pending'],
    default: 'upcoming',
    description:
      'UI-friendly timeline filter. `upcoming` includes future and in-progress items; `past` includes completed / archived items; `pending` shows booking requests awaiting confirmation.',
  })
  @IsOptional()
  @IsIn(['all', 'upcoming', 'live', 'past', 'pending'])
  state?: 'all' | 'upcoming' | 'live' | 'past' | 'pending' = 'upcoming';

  @ApiPropertyOptional({
    description: 'Filter items for a specific coach profile UUID.',
    example: 'c0000001-c000-4000-8000-000000000001',
  })
  @IsOptional()
  @IsUUID()
  coachProfileId?: string;

  @ApiPropertyOptional({
    description: 'Filter items for a specific class UUID.',
    example: 'f0000001-f000-4000-8000-000000000001',
  })
  @IsOptional()
  @IsUUID()
  classId?: string;

  @ApiPropertyOptional({
    description: 'Return items whose start time is on or after this ISO 8601 datetime (UTC).',
    example: '2026-07-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Return items whose start time is on or before this ISO 8601 datetime (UTC).',
    example: '2026-07-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort?: 'asc' | 'desc' = 'asc';
}