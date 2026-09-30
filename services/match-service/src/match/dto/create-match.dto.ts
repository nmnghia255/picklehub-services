import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  ArrayMinSize,
  IsInt,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MatchType, MatchCategory } from '@prisma/client';

export class CreateMatchDto {
  @ApiPropertyOptional({
    example: 'CUSTOM',
    enum: MatchCategory,
    description: 'The category of the match (e.g. SOCIAL, TOURNAMENT, CUSTOM).',
  })
  @IsOptional()
  @IsEnum(MatchCategory)
  category?: MatchCategory;

  @ApiPropertyOptional({
    example: 'PRACTICE',
    enum: MatchType,
    description:
      'Match format. Use `SINGLES`, `DOUBLES`, or `PRACTICE`. The team member counts must match the selected format.',
  })
  @IsOptional()
  @IsEnum(MatchType)
  matchType?: MatchType;

  @ApiProperty({
    example: '2026-03-28T08:00:00.000Z',
    description:
      'Scheduled start time in ISO 8601 format. Store UTC timestamps here so the match list and reminders sort correctly.',
  })
  @IsNotEmpty()
  @IsDateString()
  scheduledAt: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440099',
    description: 'Required reference to a court entity (sport-center-service).',
  })
  @IsNotEmpty()
  @IsUUID()
  courtId: string;

  @ApiProperty({
    example: [
      '11111111-1111-4111-8111-111111111111',
      '33333333-3333-4333-8333-333333333333',
    ],
    description: 'Team A players (UUIDs). Must contain at least one player.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  teamA: string[];

  @ApiProperty({
    example: [
      '44444444-4444-4444-8444-444444444444',
      '55555555-5555-4555-8555-555555555555',
    ],
    description: 'Team B players (UUIDs). Must contain at least one player.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  teamB: string[];

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440005',
    description:
      'Optional referee user ID. The referee can start, score, and confirm the match, but cannot also be listed as a player.',
  })
  @IsOptional()
  @IsUUID()
  refereeId?: string;



  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440007',
    description:
      'Optional tournament bracket or event ID for matches that belong to a larger competition.',
  })
  @IsOptional()
  @IsUUID()
  tournamentId?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440008',
    description: 'Optional reference to a play session.',
  })
  @IsOptional()
  @IsUUID()
  playSessionId?: string;

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
