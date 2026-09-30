import { ApiProperty } from '@nestjs/swagger';
import { EventType, Gender, EventStatus } from '@prisma/client';

export enum EventStage {
  REGISTRATION = 'registration',
  GROUP_STAGE = 'group_stage',
  KNOCKOUT_READY = 'knockout_ready',
  KNOCKOUT_STAGE = 'knockout_stage',
  COMPLETED = 'completed',
}

export class EventResponseDto {
  @ApiProperty({ description: 'The unique ID of the event', example: 10 })
  id: number;

  @ApiProperty({ description: 'The name of the event category', example: 'Mixed Doubles 4.0' })
  name: string;

  @ApiProperty({ description: 'The match type', enum: EventType, example: 'Doubles' })
  type: EventType;

  @ApiProperty({ description: 'The skill rating range allowed', example: '3.0 - 3.5' })
  skillRange: string;

  @ApiProperty({ description: 'The gender division of the event', enum: Gender, example: 'Mixed' })
  gender: Gender;

  @ApiProperty({ description: 'Number of active participants/teams registered', example: 4 })
  participants: number;

  @ApiProperty({ description: 'Maximum number of participants/teams in the event', example: 16 })
  capacity: number;

  @ApiProperty({ description: 'Entry registration fee for the event', example: 200000 })
  entryFee: number;

  @ApiProperty({ description: 'Current status of the event', enum: EventStatus, example: 'open' })
  status: EventStatus;

  @ApiProperty({ description: 'The parent tournament ID', example: 1 })
  tournamentId: number;

  @ApiProperty({ description: 'Total matches calculated for this event based on the participant count and tournament format', example: 15, required: false })
  totalMatches?: number;

  @ApiProperty({ description: 'The current phase of the event category', enum: EventStage, example: 'registration', required: false })
  currentStage?: EventStage;

  @ApiProperty({ description: 'Number of groups in the group stage', example: 4, required: false })
  numGroups?: number;

  @ApiProperty({ description: 'Total teams advancing to knockout stage', example: 8, required: false })
  totalAdvance?: number;

  @ApiProperty({ description: 'Advancement method', example: 'standard', required: false })
  advanceMethod?: string;
}



