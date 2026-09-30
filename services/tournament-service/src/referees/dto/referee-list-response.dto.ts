import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RefereeListResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'referee-uuid-123' })
  refereeId: string;

  @ApiProperty({ example: 'John Referee' })
  refereeName: string;

  @ApiPropertyOptional({ example: 'referee@picklehub.com' })
  refereeEmail: string | null;

  @ApiPropertyOptional({ example: 'http://avatar.url/ref.png' })
  refereeAvatar: string | null;

  @ApiPropertyOptional({ example: '0987654321' })
  phone: string | null;

  @ApiProperty({ example: '2026-06-28T10:00:00.000Z' })
  enrolledAt: Date;

  @ApiProperty({ description: 'Number of matches assigned to this referee', example: 5 })
  workload: number;
}
