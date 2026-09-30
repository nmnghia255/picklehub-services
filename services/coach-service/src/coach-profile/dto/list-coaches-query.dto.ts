import { IsOptional, IsString, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListCoachesQueryDto {
  @ApiPropertyOptional({ example: 'Hà Nội', description: 'Filter by city.' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Advanced', description: 'Filter by level: Beginner | Intermediate | Advanced | Pro.' })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({ example: 1, default: 1, description: 'Page number (1-indexed).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10, description: 'Number of coaches per page (max 50).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
