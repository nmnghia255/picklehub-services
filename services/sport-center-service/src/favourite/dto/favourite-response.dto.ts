import { ApiProperty } from '@nestjs/swagger';

export class FavouriteResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '660e8400-e29b-41d4-a716-446655440000' })
  centerId: string;

  @ApiProperty({ example: '770e8400-e29b-41d4-a716-446655440000' })
  userId: string;

  @ApiProperty({ example: '2024-05-21T10:30:00.000Z' })
  createdAt: Date;
}
