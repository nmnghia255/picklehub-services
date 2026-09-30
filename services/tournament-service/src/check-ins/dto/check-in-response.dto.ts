import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckInResponseDto {
  @ApiProperty({ description: 'The unique check-in ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'The parent tournament ID', example: 1 })
  tournamentId: number;

  @ApiProperty({ description: 'The unique registration ID linked to this check-in', example: 5 })
  registrationId: number;

  @ApiProperty({ description: 'Indicates if player 1 is checked in', example: true })
  player1CheckedIn: boolean;

  @ApiPropertyOptional({ description: 'Timestamp when player 1 checked in', type: String, format: 'date-time', example: '2026-06-11T09:00:00.000Z' })
  player1CheckedInAt: Date | null;

  @ApiProperty({ description: 'Indicates if player 2 (partner) is checked in', example: false })
  player2CheckedIn: boolean;

  @ApiPropertyOptional({ description: 'Timestamp when player 2 checked in', type: String, format: 'date-time', example: null })
  player2CheckedInAt: Date | null;

  @ApiProperty({ description: 'Record creation timestamp', type: String, format: 'date-time', example: '2026-06-11T08:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ description: 'Record last update timestamp', type: String, format: 'date-time', example: '2026-06-11T09:00:00.000Z' })
  updatedAt: Date;
}
