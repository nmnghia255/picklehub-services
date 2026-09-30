import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsUUID, IsArray, IsOptional, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ScheduleAssignmentDto {
  @ApiProperty({ description: 'The match ID to schedule', example: 101 })
  @IsInt()
  matchId!: number;

  @ApiProperty({ description: 'Local booking ID mapped to the slot', example: 5 })
  @IsInt()
  bookingId!: number;

  @ApiProperty({ description: 'The specific court slot booking item UUID', example: 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f' })
  @IsUUID('all')
  bookingItemId!: string;

  @ApiPropertyOptional({ description: 'The custom match duration in minutes', example: 45 })
  @IsInt()
  @Min(1)
  @IsOptional()
  matchDurationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  round?: string;

  @ApiPropertyOptional()
  @IsOptional()
  team1Name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  team2Name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  courtName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  startTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  endTime?: string;
}

export class ConfirmScheduleDto {
  @ApiProperty({ description: 'List of final match scheduling assignments', type: [ScheduleAssignmentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleAssignmentDto)
  assignments!: ScheduleAssignmentDto[];
}
