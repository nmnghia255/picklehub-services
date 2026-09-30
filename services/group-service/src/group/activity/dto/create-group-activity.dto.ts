import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDate,
  Min,
  Max,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GroupActivityType } from '@prisma/client';

export class CreateGroupActivityDto {
  @ApiProperty({ example: 'Weekend Practice' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Come join us for a fun practice session.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Court 1' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ enum: GroupActivityType, default: GroupActivityType.MEETUP })
  @IsEnum(GroupActivityType)
  activityType: GroupActivityType;

  @ApiProperty({ example: '2026-06-10T10:00:00Z' })
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  startAt: Date;

  @ApiProperty({ example: '2026-06-10T12:00:00Z' })
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  endAt: Date;

  @ApiPropertyOptional({ example: '2026-06-10T09:00:00Z', description: 'Time to send reminder' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  remindAt?: Date;

  @ApiPropertyOptional({
    example: 12,
    default: 12,
    description:
      'Number of hours before startAt after which members can no longer self-report absence or register guests. ' +
      'Host (OWNER) can always override regardless of this deadline. Defaults to 12.',
    minimum: 0,
    maximum: 168,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(168)
  cancellationDeadlineHours?: number;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Optional linked court booking ID from sport-center-service',
  })
  @IsOptional()
  @IsUUID()
  courtBookingId?: string;
}
