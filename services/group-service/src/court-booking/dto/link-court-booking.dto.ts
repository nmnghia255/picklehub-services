import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class LinkCourtBookingDto {
  @ApiPropertyOptional({
    description:
      'Human-readable label for this booking entry. ' +
      'If omitted, a title is auto-generated from the booking date ' +
      '(e.g. "Court Booking · 15/07/2026").',
    example: 'Saturday Morning Session',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Optional note visible to all group members.',
    example: '3 courts — please transfer your share by Friday.',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({
    description:
      'The booking ID from sport-center-service to link. ' +
      'The booking **must**: ' +
      '(1) belong to the caller (owner), ' +
      '(2) be CONFIRMED or COMPLETED. ' +
      'If already linked to this group, it will be rejected with 409.',
    example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  })
  @IsNotEmpty()
  @IsUUID('4')
  bookingId: string;
}
