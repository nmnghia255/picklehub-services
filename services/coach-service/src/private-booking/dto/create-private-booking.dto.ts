import { IsDateString, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreatePrivateBookingDto {
  @ApiProperty({
    example: '2026-07-20T09:00:00.000Z',
    description:
      'Desired session start time (UTC ISO 8601). The coach will confirm or reject this proposed time. ' +
      'Once confirmed, this becomes the agreed session time.',
  })
  @IsDateString()
  sessionAt: string;

  @ApiProperty({
    example: 60,
    description: 'Desired session duration in minutes. Price is calculated from coach\'s hourlyRateVnd.',
  })
  @IsInt()
  @Min(30)
  @Type(() => Number)
  durationMinutes: number;

  @ApiPropertyOptional({
    example: 'Tôi muốn cải thiện kỹ thuật serve và dinking. Có thể tập tại sân Mỹ Đình không?',
    description: 'Optional note from the learner to the coach about the session.',
  })
  @IsOptional()
  @IsString()
  learnerNote?: string;

  // ─── Location (one of two modes, both optional) ─────────────────────────────

  @ApiPropertyOptional({
    example: 'f21ddb56-dd63-4e92-9b01-e3bc6784b972',
    description:
      'ID of a CONFIRMED booking in sport-center-service that the coach has made for this session. ' +
      'The booking must belong to the coach\'s own account. When provided, the learner will see the ' +
      'court name and sport center address as the session location.',
  })
  @IsOptional()
  @IsUUID()
  courtBookingId?: string;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description:
      'Specific court UUID within the courtBookingId. Required when the sport-center booking covers ' +
      'multiple courts so the learner knows exactly which court to go to.',
  })
  @IsOptional()
  @IsUUID()
  courtId?: string;

  @ApiPropertyOptional({
    example: 'Sân Pickleball Mỹ Đình, Số 5 Lê Đức Thọ, Hà Nội',
    description:
      'Free-text venue description when the coach uses their own facility (no sport-center booking). ' +
      'Ignored if courtBookingId is provided.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  locationDescription?: string;
}

