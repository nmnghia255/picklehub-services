import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RegistrationStatus } from '@prisma/client';
import { PlayerResponseDto } from './player-response.dto';

export class RegistrationResponseDto {
  @ApiProperty({ description: 'The unique ID of the registration', example: 5 })
  id: number;

  @ApiProperty({ description: 'The parent tournament ID', example: 1 })
  tournamentId: number;

  @ApiProperty({ description: 'The target event category ID', example: 10 })
  eventId: number;

  @ApiProperty({ description: 'The player details', type: PlayerResponseDto })
  player: PlayerResponseDto;

  @ApiPropertyOptional({ description: 'The partner details (for doubles)', type: PlayerResponseDto, nullable: true })
  partner: PlayerResponseDto | null;

  @ApiProperty({ description: 'The event division name', example: "Men's Singles 3.5+" })
  event: string;

  @ApiProperty({ description: 'Payment status of registration entry fee', example: 'pending' })
  paymentStatus: string;

  @ApiPropertyOptional({ description: 'Uploaded payment proof receipt/screenshot URL', example: 'https://example.com/receipt.png' })
  paymentProofUrl: string | null;

  @ApiPropertyOptional({ description: 'Timestamp when payment proof was uploaded', type: String, format: 'date-time', example: '2026-06-11T09:00:00.000Z' })
  paymentProofUploadedAt: Date | null;

  @ApiProperty({ description: 'Current registration approval status', enum: RegistrationStatus, example: 'pending' })
  status: RegistrationStatus;

  @ApiProperty({ description: 'Registration timestamp', type: String, format: 'date-time', example: '2026-06-11T09:00:00.000Z' })
  registrationDate: Date;
}
