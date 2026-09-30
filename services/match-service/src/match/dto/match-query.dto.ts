import { ApiPropertyOptional } from '@nestjs/swagger';
import { MatchType, MatchCategory, MatchStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Min, IsDateString } from 'class-validator';

export class MatchQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, minimum: 1, default: 10 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Filter by user ID.' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter matches against a specific opponent.' })
  @IsOptional()
  @IsUUID()
  opponentId?: string;

  @ApiPropertyOptional({ enum: MatchType })
  @IsOptional()
  @IsEnum(MatchType)
  matchType?: MatchType;

  @ApiPropertyOptional({ enum: MatchCategory })
  @IsOptional()
  @IsEnum(MatchCategory)
  category?: MatchCategory;

  @ApiPropertyOptional({ enum: MatchStatus })
  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tournamentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courtId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  playSessionId?: string;

  @ApiPropertyOptional({ description: 'Filter matches scheduled on or after this ISO date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter matches scheduled on or before this ISO date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
