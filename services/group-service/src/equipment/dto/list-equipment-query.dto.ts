import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { EquipmentCondition } from '@prisma/client';

export class ListEquipmentQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Page number (1-based).', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ example: 20, description: 'Items per page.', default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({
    enum: EquipmentCondition,
    example: EquipmentCondition.GOOD,
    description:
      'Filter by physical condition. Omit to return equipment in all conditions.',
  })
  @IsEnum(EquipmentCondition)
  @IsOptional()
  condition?: EquipmentCondition;

  @ApiPropertyOptional({
    example: 'bóng',
    description: 'Case-insensitive search against equipment name.',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'When true, includes soft-deleted equipment in the results. ' +
      'This parameter is silently ignored for non-owner callers.',
    default: false,
  })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  includeDeleted?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'When true, filters the list to only return items marked as favorite.',
    default: false,
  })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isFavorite?: boolean;
}
