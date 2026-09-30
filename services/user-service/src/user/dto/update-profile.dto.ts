import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, PreferredHand } from '@prisma/client';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

function trimIfString({ value }: TransformFnParams): unknown {
  const rawValue: unknown = value;

  if (typeof rawValue === 'string') {
    return rawValue.trim();
  }

  return rawValue;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({
    example: 'Nguyen Van A',
    maxLength: 50,
    description: 'Public display name for the profile.',
  })
  @IsOptional()
  @Type(() => String)
  @Transform(trimIfString)
  @IsString()
  @MaxLength(50)
  fullName?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/avatars/user-123.png',
    maxLength: 2048,
    description: 'Avatar image URL stored as plain text.',
  })
  @IsOptional()
  @Type(() => String)
  @Transform(trimIfString)
  @IsString()
  @MaxLength(2048)
  avatarUrl?: string;

  @ApiPropertyOptional({
    example: 'Competitive pickleball player who enjoys doubles matches.',
    maxLength: 255,
    description: 'Short profile biography.',
  })
  @IsOptional()
  @Type(() => String)
  @Transform(trimIfString)
  @IsString()
  @MaxLength(255)
  bio?: string;

  @ApiPropertyOptional({
    enum: Gender,
    example: Gender.OTHER,
    description: 'Gender selection for the public profile.',
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({
    example: '2.5',
    maxLength: 255,
    description: 'Self-rated skill level.',
  })
  @IsOptional()
  @Type(() => Number)
  selfRating?: number;

  @ApiPropertyOptional({
    enum: PreferredHand,
    example: PreferredHand.RIGHT,
    description: 'Preferred playing hand.',
  })
  @IsOptional()
  @IsEnum(PreferredHand)
  preferredHand?: PreferredHand;

  @ApiPropertyOptional({
    example: '0901234567',
    maxLength: 20,
    description: 'Contact phone number.',
  })
  @IsOptional()
  @Type(() => String)
  @Transform(trimIfString)
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: '123 Nguyen Van Linh, District 7, HCMC',
    maxLength: 255,
    description: 'Home address.',
  })
  @IsOptional()
  @Type(() => String)
  @Transform(trimIfString)
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({
    example: 'Hồ Chí Minh',
    maxLength: 100,
    description: 'City or Province.',
  })
  @IsOptional()
  @Type(() => String)
  @Transform(trimIfString)
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({
    example: 'Quận 7',
    maxLength: 100,
    description: 'District name.',
  })
  @IsOptional()
  @Type(() => String)
  @Transform(trimIfString)
  @IsString()
  @MaxLength(100)
  district?: string;

  @ApiPropertyOptional({
    example: 10.7769,
    description: 'Latitude coordinate.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({
    example: 106.7009,
    description: 'Longitude coordinate.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;
}
