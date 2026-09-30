import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsInt, IsOptional, Min } from 'class-validator';

/**
 * Organizer-facing result payload for a fixture. `winner` is expressed in the bracket's
 * own terms (1 = team1, 2 = team2) and translated to the match service's TEAM_A/TEAM_B
 * before forwarding. Provide a winner, a score, or both.
 */
export class RecordResultDto {
  @ApiPropertyOptional({ enum: [1, 2], description: 'Winning side: 1 = team1, 2 = team2.' })
  @IsOptional()
  @IsIn([1, 2])
  winner?: number;

  @ApiPropertyOptional({ example: 11, description: 'Final score for team1.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  scoreA?: number;

  @ApiPropertyOptional({ example: 8, description: 'Final score for team2.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  scoreB?: number;

  @ApiPropertyOptional({ example: [[11, 5], [9, 11], [11, 8]], description: 'Set-by-set scores.' })
  @IsOptional()
  @IsArray()
  sets?: any[];
}
