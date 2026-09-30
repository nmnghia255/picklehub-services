import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateUsageLogDto {
  @ApiProperty({
    example: 3,
    description: 'Number of units consumed in this session. Must be at least 1.',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  quantityUsed!: number;

  @ApiPropertyOptional({
    example: '2 balls cracked during session',
    description: 'Optional free-form note about this usage event. ' +
      'Use this to add context (e.g. damage, weather, special session). ' +
      'Corrections to a previous log should also be recorded here as a new entry.',
  })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({
    example: '2026-06-20T08:00:00Z',
    description:
      'ISO datetime of when the usage actually happened. ' +
      'Defaults to the current server time if omitted. ' +
      'The owner may backdate this (e.g. forgot to log yesterday\'s session). ' +
      'Cannot be a future date.',
  })
  @IsDateString()
  @IsOptional()
  usedAt?: string;
}
