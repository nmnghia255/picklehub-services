import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class BookingRequestItemDto {
  @ApiProperty({
    example: 'f21ddb56-dd63-4e92-9b01-e3bc6784b972',
    description: 'Court ID to book',
  })
  @IsUUID('4')
  @IsNotEmpty()
  courtId!: string;

  @ApiProperty({
    example: '17:00',
    description: 'Start time in HH:MM format',
  })
  @IsString()
  @IsNotEmpty()
  startTime!: string;

  @ApiProperty({
    example: '19:00',
    description: 'End time in HH:MM format',
  })
  @IsString()
  @IsNotEmpty()
  endTime!: string;
}