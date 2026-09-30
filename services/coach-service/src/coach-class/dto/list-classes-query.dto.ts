import { IsDateString, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ListClassesQueryDto {
  @ApiPropertyOptional({ example: 'Hà Nội', description: 'Filter by city (case-insensitive partial match).' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Beginner', description: 'Filter by class level: Beginner | Intermediate | Advanced | Pro.' })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({
    example: '2026-07-01',
    description: 'Return only classes whose `startDate` is on or after this date (ISO 8601 date or datetime, UTC).',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-07-31',
    description: 'Return only classes whose `startDate` is on or before this date (ISO 8601 date or datetime, UTC).',
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
