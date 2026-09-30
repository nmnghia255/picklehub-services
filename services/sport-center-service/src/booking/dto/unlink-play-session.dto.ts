import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class UnlinkPlaySessionDto {
  @ApiProperty({
    example: ['a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d'],
    description: 'List of booking IDs to unlink.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  bookingIds!: string[];

  @ApiProperty({
    example: '8c24b2c6-0e6a-4a24-8f3d-9e0a3d3b2e11',
    description: 'Play session ID to unlink these bookings from.',
  })
  @IsUUID()
  playSessionId!: string;
}
