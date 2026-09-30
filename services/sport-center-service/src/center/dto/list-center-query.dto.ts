import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, IsBoolean, IsNumber } from 'class-validator';
import { SportCenterStatusDto } from './create-center.dto';

export class ListCenterQueryDto {
  @ApiPropertyOptional({
    description: 'Pagination limit',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Pagination offset',
    example: 0,
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({
    enum: SportCenterStatusDto,
    description: 'Filter sport centers by status',
    example: SportCenterStatusDto.ACTIVE,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(SportCenterStatusDto)
  status?: SportCenterStatusDto;

  @ApiPropertyOptional({
    description: 'Search keyword for center name or address',
  })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({
    description: 'Return only sport centers favourited by the current user',
    type: Boolean,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return false;
  })
  @IsBoolean()
  favouritesOnly?: boolean = false;

  @ApiPropertyOptional({
    description: 'Latitude for proximity sorting',
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({
    description: 'Longitude for proximity sorting',
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;
}
