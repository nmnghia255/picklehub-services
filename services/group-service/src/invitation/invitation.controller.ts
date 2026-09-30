import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExcludeController,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InvitationService } from './invitation.service';
import { CreateEmailInvitationDto } from './dto/invitation.dto';

const INTERNAL_HEADER = 'x-internal-token';

@ApiExcludeController()
@Controller('internal')
export class InvitationInternalController {
  constructor(private readonly invitationService: InvitationService) { }

  @Post('groups/:groupId/invitations')
  createEmailInvitation(@Param('groupId') groupId: string, @Body() body: { email: string }, @Headers() headers: any) {
    return this.invitationService.createEmailInvitation(headers, groupId, body.email);
  }

  @Get('groups/:groupId/invitations')
  listGroupInvitations(@Param('groupId') groupId: string, @Headers() headers: any) {
    return this.invitationService.listGroupInvitations(headers, groupId);
  }

  @Delete('groups/:groupId/invitations/:invitationId')
  revokeInvitation(@Param('groupId') groupId: string, @Param('invitationId') invitationId: string, @Headers() headers: any) {
    return this.invitationService.revokeInvitation(headers, groupId, invitationId);
  }

  @Get('invitations/:token')
  getByToken(@Param('token') token: string, @Headers() headers: any) {
    return this.invitationService.getInvitationByToken(headers, token);
  }

  @Post('invitations/:token/accept')
  acceptInvitation(@Param('token') token: string, @Body() body: { userId: string }, @Headers() headers: any) {
    return this.invitationService.acceptInvitation(headers, token, body.userId);
  }
}

@ApiTags('Group Invitations')
@Controller('api/groups/:groupId/invitations')
@ApiBearerAuth('access-token')
export class GroupInvitationController {
  constructor(private readonly invitationService: InvitationService) { }

  private internalHeaders(req: any) {
    return {
      [INTERNAL_HEADER]: process.env.SERVICE_INTERNAL_TOKEN,
      'x-inviter-id': req.user?.userId,
      'x-inviter-name': req.user?.name ?? req.user?.email ?? '',
    };
  }

  @Post()
  @ApiOperation({
    summary: 'Create email invitation (Owner)',
    description: 'Create an invitation for a target email in the group.',
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiBody({ type: CreateEmailInvitationDto })
  @ApiResponse({
    status: 201,
    description: 'Invitation created.',
    schema: {
      example: {
        id: '0f4f7da8-2335-4359-b808-18446b5063ad',
        targetEmail: 'member@example.com',
        status: 'PENDING',
        expiresAt: '2026-03-26T12:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Caller lacks permission.' })
  @ApiResponse({ status: 404, description: 'Group not found.' })
  @HttpCode(HttpStatus.CREATED)
  createEmailInvitation(
    @Param('groupId') groupId: string,
    @Body() body: CreateEmailInvitationDto,
    @Request() req: any,
  ) {
    return this.invitationService.createEmailInvitation(
      this.internalHeaders(req),
      groupId,
      body.email,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'List group invitations (Owner)',
    description: 'List active/pending invitations for a group.',
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiResponse({ status: 200, description: 'Invitations list returned.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Caller lacks permission.' })
  @ApiResponse({ status: 404, description: 'Group not found.' })
  @HttpCode(HttpStatus.OK)
  listGroupInvitations(@Param('groupId') groupId: string, @Request() req: any) {
    return this.invitationService.listGroupInvitations(this.internalHeaders(req), groupId);
  }

  @Delete(':invitationId')
  @ApiOperation({
    summary: 'Revoke invitation (Owner)',
    description: 'Revoke an existing invitation by id.',
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiParam({ name: 'invitationId', description: 'Invitation id (UUID).' })
  @ApiResponse({ status: 200, description: 'Invitation revoked.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Caller lacks permission.' })
  @ApiResponse({ status: 404, description: 'Group or invitation not found.' })
  @HttpCode(HttpStatus.OK)
  revokeInvitation(
    @Param('groupId') groupId: string,
    @Param('invitationId') invitationId: string,
    @Request() req: any,
  ) {
    return this.invitationService.revokeInvitation(
      this.internalHeaders(req),
      groupId,
      invitationId,
    );
  }
}
