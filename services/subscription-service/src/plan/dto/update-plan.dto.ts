import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  IsBoolean,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PlanType, BillingCycle } from '@prisma/client';

export class UpdatePlanDto {
  @ApiPropertyOptional({ example: 'Gói Quản lý Hội nhóm - Tháng (Updated)' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ example: 'Mô tả mới cho gói dịch vụ.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: ['Tính năng A', 'Tính năng B'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiPropertyOptional({ example: 129000, description: 'Price in VND.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceVnd?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
