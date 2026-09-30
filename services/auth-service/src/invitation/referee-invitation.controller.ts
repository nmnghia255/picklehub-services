import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { RefereeInvitationService } from './referee-invitation.service';

@ApiTags('Referee Invitations')
@Controller('api/referee-invitations')
export class RefereeInvitationController {
  constructor(private readonly refereeInvitationService: RefereeInvitationService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Get referee invitation metadata by token' })
  @ApiParam({ name: 'token', description: 'Invitation token (raw)' })
  @ApiResponse({
    status: 200,
    description: 'Invitation data',
  })
  @ApiNotFoundResponse({ description: 'Invitation not found.' })
  getByToken(@Param('token') token: string) {
    return this.refereeInvitationService.getInvitationByToken(token);
  }

  @Post(':token/accept')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Accept referee invitation by token' })
  @ApiResponse({
    status: 200,
    description: 'Logged into existing account and joined the tournament.',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        isNewUser: false,
        tournamentJoined: true,
        user: { id: 'f326626d-8604-4134-9e84-1e0e8bb35f60', email: 'referee@example.com', displayName: 'Nguyen Nghia' },
        tournament: { id: 1, name: 'Picklehub Master Cup 2026' }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'New account created, logged in, and joined the tournament.',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        isNewUser: true,
        tournamentJoined: true,
        user: { id: 'f326626d-8604-4134-9e84-1e0e8bb35f60', email: 'referee@example.com', displayName: 'Nguyen Nghia' },
        tournament: { id: 1, name: 'Picklehub Master Cup 2026' }
      }
    }
  })
  async accept(
    @Param('token') token: string,
    @Body() dto: AcceptInvitationDto = {},
    @Request() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const currentUser = req.user
      ? { id: req.user.sub, email: req.user.email }
      : undefined;

    const result = await this.refereeInvitationService.acceptInvitation(token, dto, currentUser);

    if ('isNewUser' in result && result.isNewUser) {
      res.status(HttpStatus.CREATED);
    } else {
      res.status(HttpStatus.OK);
    }

    return result;
  }

  @Post(':token/join')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Join as referee after login using invitation token' })
  @ApiParam({ name: 'token', description: 'Invitation token (raw)' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Successfully joined tournament.',
    schema: {
      example: {
        message: 'Successfully accepted referee invitation.',
        tournamentJoined: true,
        tournament: { id: 1, name: 'Picklehub Master Cup 2026' }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Invitation email does not match authenticated user' })
  joinAfterLogin(@Param('token') token: string, @Request() req: any) {
    return this.refereeInvitationService.joinTournamentAfterLogin(token, req.user.sub, req.user.email);
  }
}
