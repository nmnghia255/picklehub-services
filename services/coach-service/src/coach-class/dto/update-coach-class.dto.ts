import {
  IsString,
  IsOptional,
  IsUrl,
  IsInt,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateCoachClassDto {
  @ApiPropertyOptional({ example: 'Pickleball Intermediate Workshop', description: 'Updated title of the class.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ example: 'Updated description.', description: 'Updated description.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Intermediate', description: 'Skill level: Beginner | Intermediate | Advanced | Pro.' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  level?: string;

  @ApiPropertyOptional({ example: 12, description: 'Updated capacity.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  capacity?: number;

  @ApiPropertyOptional({ example: 1800000, description: 'Updated price in VND.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  priceVnd?: number;

  @ApiPropertyOptional({ example: 'Sân Pickleball Mỹ Đình, Hà Nội', description: 'Updated location description.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  locationDescription?: string;

  @ApiPropertyOptional({ example: 'https://cdn.picklehub.vn/classes/updated-cover.jpg', description: 'Updated cover image URL.' })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  coverImageUrl?: string;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z', description: 'Updated start date.' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00.000Z', description: 'Updated end date.' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
