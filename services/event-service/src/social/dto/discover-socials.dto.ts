import { ApiPropertyOptional } from '@nestjs/swagger';
import { SocialAgeGroup, SocialFormat, SocialGenderPolicy } from '@prisma/client';
import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsDateString,
    IsEnum,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    Min,
} from 'class-validator';

export class DiscoverSocialsDto {

    @ApiPropertyOptional({
        example: 1,
        minimum: 1,
        description: 'Page number (1-based). Defaults to 1.',
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({
        example: 20,
        minimum: 1,
        maximum: 100,
        description: 'Page size. Defaults to 10.',
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;

    @ApiPropertyOptional({
        example: 'friendly doubles',
        description: 'Search keyword in title/note.',
    })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({
        example: '2026-03-28T00:00:00.000Z',
        description: 'Filter sessions with startTime >= this datetime.',
    })
    @IsOptional()
    @IsDateString()
    startFrom?: string;

    @ApiPropertyOptional({
        example: '2026-04-01T00:00:00.000Z',
        description: 'Filter sessions with startTime <= this datetime.',
    })
    @IsOptional()
    @IsDateString()
    startTo?: string;

    @ApiPropertyOptional({
        example: true,
        description: 'Filter socials with upcoming sessions (startTime > now).',
    })
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    upcoming?: boolean;

    @ApiPropertyOptional({
        example: true,
        description: 'Only return socials that still have available slots.',
    })
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    hasAvailableSlots?: boolean;

    @ApiPropertyOptional({
        example: 1.5,
        description: 'Filter socials with minimum player level requirement.',
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    minimumLevel?: number;

    @ApiPropertyOptional({
        example: 7.5,
        description: 'Filter socials with maximum player level requirement.',
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    maximumLevel?: number

    @ApiPropertyOptional({
        enum: SocialFormat,
        example: SocialFormat.SOCIAL,
        description: 'Filter by social play format.',
    })
    @IsOptional()
    @IsEnum(SocialFormat)
    format?: SocialFormat

    @ApiPropertyOptional({
        enum: SocialGenderPolicy,
        example: SocialGenderPolicy.FEMALE_ONLY,
        description: 'Filter by gender policy.',
    })
    @IsOptional()
    @IsEnum(SocialGenderPolicy)
    genderPolicy?: SocialGenderPolicy;
    
    @ApiPropertyOptional({
        enum: SocialAgeGroup,
        example: SocialAgeGroup.SENIOR,
        description: 'Filter by age group.',
    })
    @IsOptional()
    @IsEnum(SocialAgeGroup)
    ageGroup?: SocialAgeGroup;

}
