import { IsInt, IsString, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ScorePointDto {
  @ApiProperty({
    example: 'e0000001-e000-4000-8000-000000000000',
    description: 'Match UUID',
  })
  @IsUUID()
  matchId!: string;

  @ApiProperty({
    example: 1,
    description: 'The index of the set (1-based)',
  })
  @IsInt()
  @Min(1)
  @Max(3)
  setId!: number;

  @ApiProperty({
    example: 'TEAM_A',
    description: 'The team scoring the point ("TEAM_A" or "TEAM_B")',
  })
  @IsString()
  scoringTeam!: 'TEAM_A' | 'TEAM_B';
}
