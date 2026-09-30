import { IsString, IsInt, IsEnum, IsOptional, IsArray, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum OptimizationCriteria {
  FASTEST = 'fastest',
  BALANCED = 'balanced',
}

export class AutoScheduleConfigDto {
  @ApiProperty({ description: 'Start time of the scheduling window (HH:MM)', example: '08:00' })
  @IsString()
  startTime: string;

  @ApiProperty({ description: 'End time of the scheduling window (HH:MM)', example: '18:00' })
  @IsString()
  endTime: string;

  @ApiProperty({ description: 'Play duration of a single match in minutes', example: 45 })
  @IsInt()
  @Min(1)
  matchDurationMinutes: number;

  @ApiPropertyOptional({ description: 'Cleanup/rest duration after a match in minutes', example: 15 })
  @IsInt()
  @Min(0)
  @IsOptional()
  restDurationMinutes?: number;


  @ApiProperty({ description: 'Optimization strategy criteria', enum: OptimizationCriteria, example: OptimizationCriteria.FASTEST })
  @IsEnum(OptimizationCriteria)
  optimizationCriteria: OptimizationCriteria;

  @ApiPropertyOptional({ description: 'Specific court IDs to restrict scheduling onto', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  courtIds?: string[];
}
