import {
  IsString,
  IsOptional,
  IsUrl,
  IsInt,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateCoachClassDto {
  @ApiProperty({ example: 'Pickleball Beginner Boot Camp', description: 'Title of the class.' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({
    example: 'A 4-week group class focused on foundational pickleball skills for absolute beginners.',
    description: 'Detailed description of the class curriculum.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'Beginner',
    description: 'Skill level targeted: Beginner | Intermediate | Advanced | Pro.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  level?: string;

  @ApiProperty({ example: 10, description: 'Maximum number of learners allowed in this class.' })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  capacity: number;

  @ApiProperty({ example: 1500000, description: 'One-time price per learner in VND.' })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  priceVnd: number;

  @ApiPropertyOptional({
    example: 'Sân Pickleball 360, 123 Lê Văn Lương, Hà Nội',
    description: 'Human-readable location description for the class sessions.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  locationDescription?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.picklehub.vn/classes/bootcamp-cover.jpg',
    description: 'URL of the class cover image.',
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  coverImageUrl?: string;

  @ApiPropertyOptional({
    example: '2026-07-15T00:00:00.000Z',
    description: 'Optional start date of the entire class programme.',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-08-15T00:00:00.000Z',
    description: 'Optional end date of the entire class programme.',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
