import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateTournamentConversationDto {
  @ApiProperty({
    description: 'Tournament UUID from tournament-service. The caller must be an organizer, approved player, referee, or admin.',
    example: '55555555-5555-4555-8555-555555555555',
  })
  @IsUUID()
  tournamentId: string;
}
