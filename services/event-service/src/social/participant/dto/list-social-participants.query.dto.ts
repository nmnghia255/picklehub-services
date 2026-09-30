import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

// #region Enums

// Mirrors @prisma/client SocialParticipantStatus values plus an ALL sentinel.
export enum ListSocialParticipantsStatusFilter {
  ALL = 'ALL',
  CONFIRMED = 'CONFIRMED',
  WAITLISTED = 'WAITLISTED',
  ON_HOLD = 'ON_HOLD',
  CANCELLED = 'CANCELLED',
}

// #endregion

export class ListSocialParticipantsQueryDto {
  @ApiPropertyOptional({
    enum: ListSocialParticipantsStatusFilter,
    example: ListSocialParticipantsStatusFilter.ALL,
    description:
      'Filter participants by status. Use ALL (default) to include every status, including CANCELLED.',
  })
  @IsOptional()
  @IsEnum(ListSocialParticipantsStatusFilter)
  status?: ListSocialParticipantsStatusFilter;
}
