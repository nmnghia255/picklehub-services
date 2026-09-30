import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateCenterPriceSlotDto {
  @ApiProperty({
    example: '06:00',
    description: 'Start time in HH:MM format',
  })
  @IsString()
  @IsNotEmpty()
  startTime!: string;

  @ApiProperty({
    example: '12:00',
    description: 'End time in HH:MM format',
  })
  @IsString()
  @IsNotEmpty()
  endTime!: string;

  @ApiProperty({
    example: 100000,
    description: 'Price per hour in local currency',
  })
  @IsNumber()
  @Min(0)
  pricePerHour!: number;
}
