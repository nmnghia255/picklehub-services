import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ListCustomersQueryDto {
  @ApiPropertyOptional({
    description: 'Optional sport center scope. Omit to search across all owned centers.',
  })
  @IsOptional()
  @IsString()
  centerId?: string;

  @ApiPropertyOptional({
    description: 'Search keyword applied to customer name, phone, or email.',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  keyword?: string;

  @ApiPropertyOptional({
    description: 'Filter by customer name.',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @ApiPropertyOptional({
    description: 'Filter by phone number.',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  phone?: string;

  @ApiPropertyOptional({
    description: 'Filter by email address.',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  email?: string;

  @ApiPropertyOptional({
    description: 'Only return customers whose latest visit happened on or after this date.',
  })
  @IsOptional()
  @IsDateString()
  lastVisitFrom?: string;

  @ApiPropertyOptional({
    description: 'Only return customers whose latest visit happened on or before this date.',
  })
  @IsOptional()
  @IsDateString()
  lastVisitTo?: string;

  @ApiPropertyOptional({
    description: 'Only return customers with spend greater than or equal to this amount.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minSpend?: number;

  @ApiPropertyOptional({
    description: 'Only return customers with spend less than or equal to this amount.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxSpend?: number;

  @ApiPropertyOptional({
    description: 'Pagination limit.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Pagination offset.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
