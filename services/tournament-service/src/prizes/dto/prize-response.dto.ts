import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PrizeResponseDto {
  @ApiProperty({ description: 'The unique ID of the prize', example: 1 })
  id: number;

  @ApiProperty({ description: 'The parent tournament ID', example: 9991 })
  tournamentId: number;

  @ApiPropertyOptional({ description: 'The linked event category ID', example: 99911 })
  eventId: number | null;

  @ApiProperty({ description: 'The name of the prize', example: 'Giải Nhất' })
  name: string;

  @ApiProperty({ description: 'The type of reward', example: 'cash' })
  rewardType: string;

  @ApiProperty({ description: 'The value in VND', example: 5000000 })
  value: number;

  @ApiPropertyOptional({ description: 'The description of the prize', example: 'Cup + 5 triệu VND' })
  description: string | null;

  @ApiPropertyOptional({ description: 'The ID of the winning team', example: 200 })
  winnerTeamId: number | null;

  @ApiProperty({ description: 'Creation timestamp', type: String, format: 'date-time', example: '2026-06-11T09:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp', type: String, format: 'date-time', example: '2026-06-11T09:00:00.000Z' })
  updatedAt: Date;
}
