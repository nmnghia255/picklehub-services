import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

/**
 * Shared DTO for linking or updating the location on an already-created
 * PrivateBooking or ClassSchedule.
 *
 * Two modes — send exactly one:
 *   A) Court link  → provide courtBookingId (+ optional courtId if the booking covers multiple courts)
 *   B) Free-text   → provide locationDescription
 *   C) Clear       → send {} to wipe the current location back to null
 */
export class UpdateSessionLocationDto {
  // ── Mode A: court link ────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'UUID of the CONFIRMED sport-center booking to link. ' +
      'The booking must be owned by the authenticated coach. ' +
      'When supplied, `locationDescription` is ignored and the court address is resolved automatically.',
    example: 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
  })
  @IsOptional()
  @IsUUID()
  courtBookingId?: string;

  @ApiPropertyOptional({
    description:
      'UUID of the specific court within the booking to associate. ' +
      'Required when the booking covers more than one court. ' +
      'Ignored if `courtBookingId` is not provided.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsUUID()
  courtId?: string;

  // ── Mode B: free-text ─────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Free-text venue description (coach\'s own facility or external address). ' +
      'Ignored when `courtBookingId` is provided.',
    example: 'Sân nhà, 123 Nguyễn Trãi, Hà Nội',
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @ValidateIf((o) => !o.courtBookingId)
  locationDescription?: string;
}
