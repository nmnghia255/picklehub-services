import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

export class ScheduleFixtureDto {
  @ApiProperty({ description: 'Local tournament booking id', example: 12 })
  @IsInt()
  bookingId!: number;

  @ApiProperty({ description: 'The sport-center booking item id (a specific court+time slot)', example: 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f' })
  @IsUUID('all')
  bookingItemId!: string;

  @ApiProperty({ description: 'Play duration of a single match in minutes', example: 45 })
  @IsInt()
  @Min(1)
  matchDurationMinutes!: number;
}
