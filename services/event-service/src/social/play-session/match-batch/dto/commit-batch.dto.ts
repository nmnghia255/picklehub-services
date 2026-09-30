import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { MatchCategory, MatchType } from '../match-enums';

export class CommitMatchItemDto {
  @ApiProperty({
    example: 'c0010000-c001-4000-8000-000000010001',
    description: 'Court UUID — taken directly from the suggest response.',
  })
  @IsNotEmpty()
  @IsUUID()
  courtId: string;

  @ApiProperty({
    example: '2026-05-23T11:00:00.000Z',
    description: 'Scheduled start time in ISO 8601 format.',
  })
  @IsNotEmpty()
  @IsDateString()
  scheduledAt: string;

  @ApiPropertyOptional({
    example: 'DOUBLES',
    enum: MatchType,
    description: 'Match format. Defaults to DOUBLES.',
  })
  @IsOptional()
  @IsEnum(MatchType)
  matchType?: MatchType;

  @ApiPropertyOptional({
    example: 'SOCIAL',
    enum: MatchCategory,
    description: 'Match category. Defaults to SOCIAL.',
  })
  @IsOptional()
  @IsEnum(MatchCategory)
  category?: MatchCategory;

  @ApiProperty({
    example: ['11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333'],
    description: 'Team A player user UUIDs (after any manual edits by the host).',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  teamA: string[];

  @ApiProperty({
    example: ['44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555'],
    description: 'Team B player user UUIDs (after any manual edits by the host).',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  teamB: string[];

  @ApiPropertyOptional({
    description: 'Optional referee user UUID.',
  })
  @IsOptional()
  @IsUUID()
  refereeId?: string;
}

export class CommitBatchDto {
  @ApiProperty({
    type: [CommitMatchItemDto],
    description:
      'The final list of matches to create — exactly as the host confirmed on the frontend ' +
      '(may differ from what suggest returned). Max 20 per call.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CommitMatchItemDto)
  matches: CommitMatchItemDto[];
}
