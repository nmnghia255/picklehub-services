import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TournamentStatus, EventType, Gender, EventStatus } from '@prisma/client';

export class TournamentResponseDto {
  @ApiProperty({ description: 'The unique ID of the tournament', example: 1 })
  id: number;

  @ApiPropertyOptional({ description: 'The ID of the organizer user', example: 'user-uuid-123' })
  organizerId: string | null;

  @ApiProperty({ description: 'The name of the tournament', example: 'Summer Open 2026' })
  name: string;

  @ApiProperty({ description: 'The location where the tournament will take place', example: 'Central Sports Center' })
  venue: string;

  @ApiProperty({ description: 'The starting date of the tournament', type: String, format: 'date-time', example: '2026-07-01T08:00:00.000Z' })
  startDate: Date;

  @ApiProperty({ description: 'The ending date of the tournament', type: String, format: 'date-time', example: '2026-07-05T18:00:00.000Z' })
  endDate: Date;

  @ApiProperty({ description: 'The number of currently registered players', example: 5 })
  registered: number;

  @ApiProperty({ description: 'The current status of the tournament', enum: TournamentStatus, example: 'draft' })
  status: TournamentStatus;

  @ApiPropertyOptional({ description: 'URL of the tournament banner image', example: 'https://example.com/banner.jpg' })
  banner: string | null;

  @ApiPropertyOptional({ description: 'Detailed description of the tournament', example: 'Summer Open 2026 for all skill levels.' })
  description?: string | null;

  @ApiPropertyOptional({ description: 'The starting date for registration (ISO format)', type: String, format: 'date-time', example: '2026-06-15T08:00:00.000Z' })
  registrationStartDate: Date | null;

  @ApiPropertyOptional({ description: 'The ending date for registration (ISO format)', type: String, format: 'date-time', example: '2026-06-30T18:00:00.000Z' })
  registrationEndDate: Date | null;

  @ApiPropertyOptional({ description: 'Bank name for entry fee payment transfers', example: 'Vietcombank' })
  paymentBankName: string | null;

  @ApiPropertyOptional({ description: 'Bank account owner name', example: 'NGUYEN VAN A' })
  paymentAccountName: string | null;

  @ApiPropertyOptional({ description: 'Bank account number', example: '1029384756' })
  paymentAccountNumber: string | null;

  @ApiPropertyOptional({ description: 'QR code image URL for payments', example: 'https://example.com/qr.jpg' })
  paymentQrUrl: string | null;

  @ApiPropertyOptional({ description: 'Payment instructions or note', example: 'CK cu phap: CK TOURNAMENT [ID] [TEN PLAYER]' })
  paymentNote: string | null;

  @ApiProperty({ description: 'The creation timestamp', type: String, format: 'date-time', example: '2026-06-11T09:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ description: 'The last update timestamp', type: String, format: 'date-time', example: '2026-06-11T09:00:00.000Z' })
  updatedAt: Date;
}

export class PaginationMetaDto {
  @ApiProperty({ description: 'Total number of items matching the filter query', example: 42 })
  total: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Number of items per page', example: 10 })
  limit: number;

  @ApiProperty({ description: 'Total number of pages', example: 5 })
  totalPages: number;
}

export class PaginatedTournamentsResponseDto {
  @ApiProperty({ description: 'List of tournaments on the current page', type: [TournamentResponseDto] })
  data: TournamentResponseDto[];

  @ApiProperty({ description: 'Pagination metadata' })
  meta: PaginationMetaDto;
}

export class TournamentEventResponseDto {
  @ApiProperty({ description: 'The unique ID of the event category', example: 11 })
  id: number;

  @ApiProperty({ description: 'The name of the event category', example: "Men's Singles 3.5+" })
  name: string;

  @ApiProperty({ description: 'The event match type', enum: EventType, example: 'Singles' })
  type: EventType;

  @ApiProperty({ description: 'The skill range restriction', example: '3.5-4.5' })
  skillRange: string;

  @ApiProperty({ description: 'The gender restriction', enum: Gender, example: 'Men' })
  gender: Gender;

  @ApiProperty({ description: 'The number of registered participants in this event category', example: 2 })
  participants: number;

  @ApiProperty({ description: 'Maximum number of participants allowed in this event category', example: 16 })
  capacity: number;

  @ApiProperty({ description: 'Entry fee for registration in Vietnamese Dong (VND)', example: 150000 })
  entryFee: number;

  @ApiProperty({ description: 'The current registration status of this event category', enum: EventStatus, example: 'open' })
  status: EventStatus;

  @ApiProperty({ description: 'The unique ID of the parent tournament', example: 1 })
  tournamentId: number;
}

export class TournamentDetailsResponseDto extends TournamentResponseDto {
  @ApiProperty({ description: 'The list of event divisions / categories in this tournament', type: [TournamentEventResponseDto] })
  events: TournamentEventResponseDto[];

  @ApiProperty({ description: 'The total number of actual participants in the tournament', example: 10 })
  participantCount: number;
}
