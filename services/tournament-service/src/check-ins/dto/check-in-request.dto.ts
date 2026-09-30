import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckInRequestDto {
  @ApiProperty({
    description: 'The player to check in (player1 refers to the registering player, player2 refers to the partner)',
    enum: ['player1', 'player2'],
    example: 'player1',
  })
  @IsEnum(['player1', 'player2'])
  player: 'player1' | 'player2';
}
