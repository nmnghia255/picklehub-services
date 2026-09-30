import { IsDateString, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateClassScheduleDto {
  @ApiProperty({
    example: '2026-07-19T09:00:00.000Z',
    description: 'ISO 8601 datetime for the start of this session (UTC).',
  })
  @IsDateString()
  scheduledAt: string;

  @ApiProperty({
    example: 90,
    description: 'Duration of the session in minutes.',
  })
  @IsInt()
  @Min(15)
  @Type(() => Number)
  durationMinutes: number;

  @ApiPropertyOptional({
    example: 'Luyện tập kỹ thuật serve và return',
    description:
      'Learning objective or subject of this session — what the learners will focus on and practise. ' +
      'Keep it short (e.g. "Kỹ thuật dinking & kitchen play"). Different from `note` which is for logistics.',
  })
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiPropertyOptional({
    example: 'Mang vợt riêng. Sân số 3.',
    description:
      'Logistics / reminder note for this session (equipment, court number, weather contingency, etc.). ' +
      'Different from `topic` which describes the learning goal.',
  })
  @IsOptional()
  @IsString()
  note?: string;

  // ─── Per-session location override ───────────────────────────────────────────
  // When set, overrides the class-level coachClass.locationDescription for this occurrence.

  @ApiPropertyOptional({
    example: 'f21ddb56-dd63-4e92-9b01-e3bc6784b972',
    description:
      'ID of a CONFIRMED booking in sport-center-service for this session occurrence. ' +
      'The booking must belong to the coach\'s account. When provided, learners see the exact court and address.',
  })
  @IsOptional()
  @IsUUID()
  courtBookingId?: string;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description:
      'Specific court UUID within the courtBookingId (required when the booking covers multiple courts).',
  })
  @IsOptional()
  @IsUUID()
  courtId?: string;

  @ApiPropertyOptional({
    example: 'Sân Pickleball ABC, 88 Nguyễn Trãi, Hà Nội',
    description:
      'Free-text venue for this specific session when the coach uses their own facility. ' +
      'Ignored if courtBookingId is provided. Overrides class-level locationDescription.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  locationDescription?: string;
}

