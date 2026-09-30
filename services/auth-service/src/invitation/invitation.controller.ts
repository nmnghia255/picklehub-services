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
  ApiConflictResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { InvitationService } from './invitation.service';
/**
 * Routes scoped under /api/invitations
 * Public unless noted.
 */
@ApiTags('Invitations')
@Controller('api/invitations')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  /**
   * GET /api/invitations/:token
   *
   * Verify token and retrieve invitation + group info. Public.
   * Works for both email invitations and shareable links.
   * Returns 200 with invitation data, or 410 if expired.
   */
  @Get(':token')
  @ApiOperation({ summary: 'Get invitation metadata by token' })
  @ApiParam({ name: 'token', description: 'Invitation token (raw)' })
  @ApiResponse({
    status: 200,
    description: 'Invitation data (email may be null for shareable links)',
    schema: {
      example: {
        id: 'inv_0123456789abcdef',
        email: 'invitee@example.com',
        group: { id: 'grp_0123', name: 'Local Club' },
        status: 'pending',
        expiresAt: '2026-03-24T12:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 410, description: 'Invitation expired.' })
  @ApiNotFoundResponse({ description: 'Invitation not found.' })
  getByToken(@Param('token') token: string) {
    return this.invitationService.getInvitationByToken(token);
  }

  /**
   * POST /api/invitations/:token/accept
   *
   * Magic-link accept for email invitations only.
   * Three possible outcomes:
   *
   * • New user         → 201: auto-create account + issue tokens + join group
   * • Existing user    → 200: auto-login + issue tokens + join group
   * • Already logged in → 200: join group directly
   */
  @Post(':token/accept')
  @UseGuards(OptionalJwtAuthGuard)
  async accept(
    @Param('token') token: string,
    @Body() dto: AcceptInvitationDto = {},
    @Request() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const currentUser = req.user
      ? { id: req.user.sub, email: req.user.email }
      : undefined;

    // Swagger: document possible outcomes (201 for new user, 200 otherwise)
    const result = await this.invitationService.acceptInvitation(token, dto, currentUser);

    // 201 for new users, 200 for existing users or already logged in
    if ('isNewUser' in result && result.isNewUser) {
      res.status(HttpStatus.CREATED);
    } else {
      res.status(HttpStatus.OK);
    }

    return result;
  }

  /**
   * POST /api/invitations/:token/join
   *
   * Called after a pre-existing user completes normal login.
   * Requires a valid JWT. Adds the authenticated user to the group
   * referenced by the invitation token.
   * Returns: { message, groupJoined: true, group: { id, name } }
   */
  @Post(':token/join')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Join a group after login using invitation token' })
  @ApiParam({ name: 'token', description: 'Invitation token (raw)' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Successfully joined group.',
    schema: {
      example: {
        message: 'Successfully joined group.',
        groupJoined: true,
        group: { id: 'grp_0123', name: 'Local Club' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Invitation email does not match authenticated user' })
  @ApiConflictResponse({ description: 'Already a member or invitation already accepted' })
  joinAfterLogin(@Param('token') token: string, @Request() req: any) {
    return this.invitationService.joinGroupAfterLogin(token, req.user.sub, req.user.email);
  }
}

