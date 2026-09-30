import { ApiProperty } from '@nestjs/swagger';

export class StandingRowDto {
  @ApiProperty({ example: 1, description: 'Final placement (1 = champion).' })
  position!: number;

  @ApiProperty({ example: 12 })
  teamId!: number;

  @ApiProperty({ example: 'Alice / Bob' })
  name!: string;

  @ApiProperty({ example: 1, nullable: true })
  seed!: number | null;

  @ApiProperty({ example: 3 })
  wins!: number;

  @ApiProperty({ example: 0 })
  losses!: number;

  @ApiProperty({ example: 'Champion', description: 'Outcome: Champion, Runner-up, the round eliminated in, or In progress.' })
  result!: string;
}

export class StandingsMetaDto {
  @ApiProperty({ example: 8 })
  total!: number;

  @ApiProperty({ example: 12, nullable: true, description: 'Champion team id, or null until the final is decided.' })
  championTeamId!: number | null;

  @ApiProperty({ example: 'Alice / Bob', nullable: true, description: 'Champion team display name, or null until the final is decided.' })
  championTeamName!: string | null;
}

export class StandingsResponseDto {
  @ApiProperty({ type: [StandingRowDto] })
  data!: StandingRowDto[];

  @ApiProperty({ type: StandingsMetaDto })
  meta!: StandingsMetaDto;
}
