import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MatchStatus } from '@prisma/client';

export class RefereeEventDto {
  @ApiProperty({ description: 'The name of the event category', example: 'Men Singles 3.5+' })
  name: string;

  @ApiProperty({ description: 'The match type', example: 'Singles' })
  type: string;
}

export class RefereeCourtDto {
  @ApiProperty({ description: 'The court name/number', example: 'Court 1' })
  name: string;
}

export class MatchRefereeAssignmentResponseDto {
  @ApiProperty({ description: 'The unique match ID', example: 50 })
  id: number;

  @ApiProperty({ description: 'The parent tournament ID', example: 1 })
  tournamentId: number;

  @ApiProperty({ description: 'The event division ID', example: 10 })
  eventId: number;

  @ApiPropertyOptional({ description: 'The tournament bracket round', example: 'Quarterfinals' })
  round: string | null;

  @ApiPropertyOptional({ description: 'The ID of the first team', example: 101 })
  team1Id: number | null;

  @ApiPropertyOptional({ description: 'The ID of the second team', example: 102 })
  team2Id: number | null;

  @ApiPropertyOptional({ description: 'The ID of the winning team', example: 101 })
  winner: number | null;

  @ApiPropertyOptional({ description: 'The score of the match', example: '11-8, 11-9' })
  score: string | null;

  @ApiProperty({ description: 'The current status of the match', enum: MatchStatus, example: 'in_progress' })
  status: MatchStatus;

  @ApiPropertyOptional({ description: 'The assigned court ID', example: 3 })
  courtId: number | null;

  @ApiPropertyOptional({ description: 'The scheduled match start date/time', type: String, format: 'date-time', example: '2026-06-11T10:00:00.000Z' })
  time: Date | null;

  @ApiPropertyOptional({ description: 'The actual match start date/time', type: String, format: 'date-time', example: '2026-06-11T10:05:00.000Z' })
  startTime: Date | null;

  @ApiPropertyOptional({ description: 'The duration of the match in minutes', example: 35 })
  duration: number | null;

  @ApiPropertyOptional({ description: 'The match priority level', example: 'High' })
  priority: string | null;

  @ApiPropertyOptional({ description: 'The assigned referee user ID', example: 'referee-7' })
  refereeId: string | null;

  @ApiPropertyOptional({ description: 'The assigned referee full name', example: 'John Ref' })
  refereeName: string | null;

  @ApiPropertyOptional({ description: 'Event details', type: RefereeEventDto })
  event?: RefereeEventDto;

  @ApiPropertyOptional({ description: 'Court details', type: RefereeCourtDto })
  court?: RefereeCourtDto;
}

export class MyAssignmentsResponseDto {
  @ApiProperty({ description: 'Indicates if the logged-in user is a referee in this tournament', example: true })
  isReferee: boolean;

  @ApiProperty({ description: 'List of referee match assignments', type: [MatchRefereeAssignmentResponseDto] })
  assignments: MatchRefereeAssignmentResponseDto[];
}
