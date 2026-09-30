import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty } from 'class-validator';

export class AvailabilityQueryDto {
  @ApiProperty({
    example: '2026-05-15',
    description: 'Date to check availability in YYYY-MM-DD format',
  })
  @IsDateString()
  @IsNotEmpty()
  date!: string;
}
