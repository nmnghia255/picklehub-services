import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlayerResponseDto } from '../../registrations/dto/player-response.dto';

export class TeamResponseDto {
  @ApiProperty({ description: 'The unique ID of the team', example: 100 })
  id: number;

  @ApiProperty({ description: 'The player 1 details', type: PlayerResponseDto })
  player1: PlayerResponseDto;

  @ApiPropertyOptional({ description: 'The player 2 details (for doubles)', type: PlayerResponseDto, nullable: true })
  player2: PlayerResponseDto | null;

  @ApiPropertyOptional({ description: 'The average skill rating of the team', example: 4.12 })
  avgRating: number | null;
}
