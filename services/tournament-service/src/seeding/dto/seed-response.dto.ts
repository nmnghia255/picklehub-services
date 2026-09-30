import { ApiProperty } from '@nestjs/swagger';

export class SeedResponseDto {
  @ApiProperty({ description: 'Seed number (1 = top seed)', example: 1 })
  seed!: number;

  @ApiProperty({ description: 'The seeded team id (used to reorder)', example: 42 })
  teamId!: number;

  @ApiProperty({ description: 'Display name of the team', example: 'John Doe / Jane Roe' })
  team!: string;

  @ApiProperty({ description: 'Rating used for seeding', example: 4.25 })
  rating!: number;

  @ApiProperty({ description: 'Wins recorded so far', example: 0 })
  wins!: number;

  @ApiProperty({ description: 'Losses recorded so far', example: 0 })
  losses!: number;

  @ApiProperty({ description: 'Whether the seeding is locked', example: 'unlocked', enum: ['locked', 'unlocked'] })
  status!: string;
}

export class SeedListResponseDto {
  @ApiProperty({ type: [SeedResponseDto] })
  data!: SeedResponseDto[];

  @ApiProperty({ description: 'List metadata', example: { total: 8 } })
  meta!: { total: number };
}
