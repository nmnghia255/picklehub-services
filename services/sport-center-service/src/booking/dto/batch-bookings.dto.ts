import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class BatchBookingsDto {
  @ApiProperty({
    type: [String],
    example: [
      'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      'f21ddb56-dd63-4e92-9b01-e3bc6784b972',
    ],
    description: 'List of booking IDs to fetch',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  bookingIds!: string[];
}
