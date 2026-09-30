import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlayerResponseDto {
  @ApiPropertyOptional({ description: 'The player user ID', example: 'player-1' })
  id?: string;

  @ApiProperty({ description: 'The player full name', example: 'John Doe' })
  name: string;

  @ApiProperty({ description: 'The player rating', example: 4.1 })
  rating: number;

  @ApiPropertyOptional({ description: 'The player avatar image URL', example: 'https://example.com/avatar.png' })
  avatar?: string;

  @ApiPropertyOptional({ description: 'The player age', example: 25 })
  age?: number;

  @ApiPropertyOptional({ description: 'The player gender', example: 'M' })
  gender?: string;

  @ApiPropertyOptional({ description: 'The player DUPR ID', example: 'DUPR1234' })
  duprId?: string | null;
}
