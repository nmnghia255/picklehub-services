import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsUUID, ArrayNotEmpty } from 'class-validator';
import { MatchStatus } from '@prisma/client';

export class QueryMatchesBySessionsInternalDto {
  @ApiProperty({ description: 'List of Play Session UUIDs', type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true, message: 'Each playSessionId must be a valid UUID v4' })
  playSessionIds: string[];

  @ApiPropertyOptional({ enum: MatchStatus, description: 'Optional status filter' })
  @IsEnum(MatchStatus)
  @IsOptional()
  status?: MatchStatus;
}
