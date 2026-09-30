import { ApiProperty } from '@nestjs/swagger';

export class ReviewResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '660e8400-e29b-41d4-a716-446655440000' })
  centerId: string;

  @ApiProperty({ example: '770e8400-e29b-41d4-a716-446655440000' })
  userId: string;

  @ApiProperty({ example: 'John Doe' })
  userName?: string;

  @ApiProperty({ example: 4 })
  rating: number;

  @ApiProperty({ example: 'Great place! Well maintained courts and friendly staff.', nullable: true })
  comment?: string | null;

  @ApiProperty({ example: '2024-05-21T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-05-21T10:30:00.000Z' })
  updatedAt: Date;
}
