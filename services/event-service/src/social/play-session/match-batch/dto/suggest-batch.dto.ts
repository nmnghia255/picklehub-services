import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class SuggestBatchDto {
  @ApiPropertyOptional({
    example: 0,
    minimum: 0,
    maximum: 16,
    description: 'How many SINGLES matches to generate per round.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(16)
  singlesCount?: number;

  @ApiPropertyOptional({
    example: 2,
    minimum: 0,
    maximum: 16,
    description: 'How many DOUBLES matches to generate per round.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(16)
  doublesCount?: number;

  @ApiPropertyOptional({
    example: 30,
    minimum: 10,
    maximum: 120,
    description: 'Duration of each round in minutes. Defaults to 30.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(120)
  roundDurationMins?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['9b8e1d77-21d7-49a8-a4d4-3eee5d2b04ff'],
    description:
      'PlaySessionParticipant ids to bench for this entire generation. ' +
      'Useful when a player needs a break or the host wants to manually rotate. ' +
      'Pass an empty array or omit to bench nobody.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(64)
  @IsUUID('all', { each: true })
  excludeParticipantIds?: string[];
}
