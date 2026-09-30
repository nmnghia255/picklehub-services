import { ApiProperty } from '@nestjs/swagger';

export class MatchTeamPlayerDto {
  @ApiProperty({ description: 'Player user ID', example: 'e0000012-e000-4000-8000-000000000000', nullable: true })
  id!: string | null;

  @ApiProperty({ description: 'Player full name', example: 'Tournament Player 12', nullable: true })
  name!: string | null;

  @ApiProperty({ description: 'Player rating', example: 3.94, nullable: true })
  rating!: number | null;

  @ApiProperty({ description: 'Player gender', example: 'M', nullable: true })
  gender!: string | null;

  @ApiProperty({ description: 'Player DUPR ID', example: null, nullable: true })
  duprId!: string | null;
}

export class MatchTeamDto {
  @ApiProperty({ description: 'The team id', example: 42 })
  teamId!: number;

  @ApiProperty({ description: 'Display name of the team', example: 'John Doe / Jane Roe' })
  name!: string;

  @ApiProperty({ description: 'Seed number of the team', example: 1, nullable: true })
  seed!: number | null;

  @ApiProperty({ description: 'Team rating', example: 4.25, nullable: true })
  rating!: number | null;

  @ApiProperty({ description: 'Player 1 details', type: MatchTeamPlayerDto })
  player1!: MatchTeamPlayerDto;

  @ApiProperty({ description: 'Player 2 details (doubles only)', type: MatchTeamPlayerDto, nullable: true })
  player2!: MatchTeamPlayerDto | null;
}

export class BracketMatchDto {
  @ApiProperty({ description: 'Local match (fixture) id', example: 1001 })
  id!: number;

  @ApiProperty({ description: 'Round label', example: 'Quarterfinal', nullable: true })
  round!: string | null;

  @ApiProperty({ description: 'Position within the round (0-based)', example: 0, nullable: true })
  bracketPosition!: number | null;

  @ApiProperty({ description: 'Id of the match this one feeds into', example: 1005, nullable: true })
  nextMatchId!: number | null;

  @ApiProperty({ description: 'Deprecated: Formerly used in Double Elimination. Always null.', example: null, nullable: true })
  loserMatchId!: number | null;

  @ApiProperty({ description: 'The bracket stage', example: 'Winner Bracket', nullable: true })
  stage!: string | null;

  @ApiProperty({ description: 'match-service match UUID once dispatched', nullable: true })
  externalMatchId!: string | null;

  @ApiProperty({ description: 'Match status', example: 'scheduled' })
  status!: string;

  @ApiProperty({ description: 'Winner: 1 = team1, 2 = team2', example: null, nullable: true })
  winner!: number | null;

  @ApiProperty({ description: 'Score summary', example: null, nullable: true })
  score!: string | null;

  @ApiProperty({ type: MatchTeamDto, nullable: true })
  team1!: MatchTeamDto | null;

  @ApiProperty({ type: MatchTeamDto, nullable: true })
  team2!: MatchTeamDto | null;

  @ApiProperty({ description: 'The assigned referee user ID', example: 'e0000012-e000-4000-8000-000000000000', nullable: true })
  refereeId!: string | null;

  @ApiProperty({ description: 'The assigned referee name', example: 'Jane Smith', nullable: true })
  refereeName!: string | null;
}

export class BracketResponseDto {
  @ApiProperty({ type: [BracketMatchDto] })
  data!: BracketMatchDto[];

  @ApiProperty({ description: 'List metadata', example: { total: 7 } })
  meta!: { total: number };

  @ApiProperty({ description: 'Whether the bracket is locked', example: 'unlocked', enum: ['locked', 'unlocked'] })
  status!: string;
}
