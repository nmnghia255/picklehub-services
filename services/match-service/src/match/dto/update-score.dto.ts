import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateScoreDto {
  @ApiProperty({
    example: 11,
    description:
      'Current score for Team A in the active rally or set. Use the latest authoritative score that should be broadcast to clients.',
  })
  @IsInt()
  @Min(0)
  @Max(99)
  scoreA: number | undefined;

  @ApiProperty({
    example: 8,
    description:
      'Current score for Team B in the active rally or set. This should stay synchronized with the score shown to spectators.',
  })
  @IsInt()
  @Min(0)
  @Max(99)
  scoreB: number | undefined;

  @ApiPropertyOptional({
    example: [[11, 5], [9, 11], [11, 8]],
    description:
      'Optional set-by-set breakdown as `[[teamA, teamB], ...]`. Include one entry for each completed set when the current score represents a match result rather than a single rally.',
    type: 'array',
    items: { type: 'array', items: { type: 'number' } },
  })
  @IsOptional()
  sets?: number[][];

  @ApiPropertyOptional({
    example: 'Point awarded after challenge review.',
    description:
      'Optional human-readable note that explains why the score changed. This is stored in the immutable score update audit trail.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
