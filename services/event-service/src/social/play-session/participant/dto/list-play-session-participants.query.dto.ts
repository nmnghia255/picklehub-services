import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

// Mirrors PlaySessionParticipantStatus values plus an ALL sentinel.
export enum ListPlaySessionParticipantsStatusFilter {
  ALL = 'ALL',
  CONFIRMED = 'CONFIRMED',
  WAITLISTED = 'WAITLISTED',
  ON_HOLD = 'ON_HOLD',
  CANCELLED = 'CANCELLED',
}

export class ListPlaySessionParticipantsQueryDto {
  @ApiPropertyOptional({
    enum: ListPlaySessionParticipantsStatusFilter,
    example: ListPlaySessionParticipantsStatusFilter.ALL,
    description:
      'Filter PSP rows by status. Default ALL includes guests, cancelled, and waitlisted rows.',
  })
  @IsOptional()
  @IsEnum(ListPlaySessionParticipantsStatusFilter)
  status?: ListPlaySessionParticipantsStatusFilter;
}
