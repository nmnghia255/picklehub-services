import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Body for PATCH /api/matches/:id/start
 * All fields are optional — the endpoint can be called with an empty body.
 */
export class StartMatchDto {
  @ApiPropertyOptional({
    description:
      'UUID of the player who serves first (right-court player of the team that won the coin toss). ' +
      'Must belong to one of the players in teamA or teamB. ' +
      'If omitted, defaults to teamA[0] serving first (standard USAP rule).',
    example: '44444444-4444-4444-8444-444444444444',
  })
  @IsOptional()
  @IsUUID()
  firstServingPlayerId?: string;
}
