import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateIf,
  ValidateNested,
  IsInt,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MatchType, MatchCategory } from '@prisma/client';

export class BatchMatchItemDto {
  @ApiPropertyOptional({
    example: 'SOCIAL',
    enum: MatchCategory,
    description: 'Match category. Defaults to SOCIAL when omitted.',
  })
  @IsOptional()
  @IsEnum(MatchCategory)
  category?: MatchCategory;

  @ApiPropertyOptional({
    example: 'DOUBLES',
    enum: MatchType,
    description: 'Match format. Defaults to DOUBLES when omitted.',
  })
  @IsOptional()
  @IsEnum(MatchType)
  matchType?: MatchType;

  @ApiProperty({
    example: '2026-05-23T11:00:00.000Z',
    description: 'Scheduled start time in ISO 8601 format.',
  })
  @IsNotEmpty()
  @IsDateString()
  scheduledAt: string;

  @ApiProperty({
    example: 'c0010000-c001-4000-8000-000000010001',
    description: 'Court UUID (sport-center-service).',
  })
  @IsNotEmpty()
  @IsUUID()
  courtId: string;

  @ApiProperty({
    example: ['11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333'],
    description: 'Team A player UUIDs.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  teamA: string[];

  @ApiProperty({
    example: ['44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555'],
    description: 'Team B player UUIDs.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  teamB: string[];

  @ApiPropertyOptional({
    example: '22222222-2222-4222-8222-222222222222',
    description: 'Optional referee user UUID.',
  })
  @IsOptional()
  @IsUUID()
  refereeId?: string;

  @ApiPropertyOptional({
    example: 3,
    description: 'The number of sets in the match format. Must be an odd number in [1, 3, 5]. Defaults to 3.',
  })
  @IsOptional()
  @IsInt()
  @IsIn([1, 3, 5], { message: 'bestOfSets must be one of [1, 3, 5]' })
  bestOfSets?: number;

  @ApiPropertyOptional({
    example: 11,
    description: 'The number of points needed to win a set. Must be in [11, 15, 21]. Defaults to 11.',
  })
  @IsOptional()
  @IsInt()
  @IsIn([11, 15, 21], { message: 'pointsToWin must be one of [11, 15, 21]' })
  pointsToWin?: number;
}

export class CreateMatchBatchDto {
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440008',
    description: 'Play session UUID these matches belong to. Either this or tournamentId is required.',
  })
  @ValidateIf((o) => !o.tournamentId)
  @IsUUID()
  playSessionId?: string;

  @ApiPropertyOptional({
    example: '11111111-1111-4111-8111-111111111111',
    description: 'Tournament UUID these matches belong to. Either this or playSessionId is required. When set, matches default to category TOURNAMENT.',
  })
  @ValidateIf((o) => !o.playSessionId)
  @IsUUID()
  tournamentId?: string;

  @ApiProperty({
    example: '11111111-1111-4111-8111-111111111111',
    description: 'User UUID of the organizer creating the batch.',
  })
  @IsNotEmpty()
  @IsUUID()
  createdById: string;

  @ApiProperty({
    type: [BatchMatchItemDto],
    description: 'List of matches to create. Max 1000 per call.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => BatchMatchItemDto)
  matches: BatchMatchItemDto[];
}
