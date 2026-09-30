import { ApiProperty } from '@nestjs/swagger';

export class RefereeInvitationItemDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'referee@example.com' })
  email: string;

  @ApiProperty({ example: 'PENDING', enum: ['PENDING', 'ACCEPTED', 'REVOKED'] })
  status: string;

  @ApiProperty({ example: '2026-07-13T00:00:00.000Z' })
  expiresAt: Date;

  @ApiProperty({ example: '2026-07-06T09:00:00.000Z' })
  createdAt: Date;
}

export class AcceptInvitationResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken: string;

  @ApiProperty({ example: false, description: 'True if a new account was auto-created' })
  isNewUser: boolean;

  @ApiProperty({ example: true })
  tournamentJoined: boolean;

  @ApiProperty({
    example: {
      id: 'f326626d-8604-4134-9e84-1e0e8bb35f60',
      email: 'referee@example.com',
      displayName: 'Nguyen Nghia',
    },
  })
  user: { id: string; email: string; displayName: string };

  @ApiProperty({ example: { id: 1, name: 'Picklehub Master Cup 2026' } })
  tournament: { id: number; name: string };
}

export class JoinTournamentResponseDto {
  @ApiProperty({ example: 'Successfully joined tournament as referee.' })
  message: string;

  @ApiProperty({ example: true })
  tournamentJoined: boolean;

  @ApiProperty({ example: { id: 1, name: 'Picklehub Master Cup 2026' } })
  tournament: { id: number; name: string };
}

export class InviteRefereeResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Invitation sent successfully.' })
  message: string;

  @ApiProperty({ example: 'referee@example.com' })
  email: string;

  @ApiProperty({ example: 'pending' })
  status: string;
}

export class RevokeInvitationResponseDto {
  @ApiProperty({ example: true })
  success: boolean;
}
