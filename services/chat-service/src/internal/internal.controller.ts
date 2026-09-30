import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { InternalTokenGuard } from '../guards/internal-token.guard';
import { SyncGroupChatDto } from './dto/sync-group-chat.dto';
import { SystemMessageDto } from './dto/system-message.dto';
import { InternalService } from './internal.service';

@ApiTags('Internal Chat')
@ApiSecurity('x-internal-token')
@UseGuards(InternalTokenGuard)
@Controller('api/chats/internal')
export class InternalController {
  constructor(private readonly internalService: InternalService) {}

  @Post('groups/:groupId/sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Synchronize group chat participants',
    description:
      'Internal endpoint for group-service. Ensures a group conversation exists and aligns chat participants with current group members. Frontend clients should not call this endpoint.',
  })
  @ApiParam({ name: 'groupId', example: '22222222-2222-4222-8222-222222222222' })
  @ApiBody({ type: SyncGroupChatDto })
  @ApiOkResponse({
    description: 'Group chat synchronized.',
    schema: {
      example: {
        conversationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        groupId: '22222222-2222-4222-8222-222222222222',
        syncedMemberCount: 2,
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Missing or invalid internal token.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  syncGroup(@Param('groupId') groupId: string, @Body() dto: SyncGroupChatDto) {
    return this.internalService.syncGroup(groupId, dto.memberIds);
  }

  @Post('socials/:socialId/sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Synchronize social chat participants',
    description:
      'Internal endpoint for event-service. Ensures a social conversation exists and aligns chat participants with current social members. Frontend clients should not call this endpoint.',
  })
  @ApiParam({ name: 'socialId', example: '44444444-4444-4444-8444-444444444444' })
  @ApiBody({ type: SyncGroupChatDto })
  @ApiOkResponse({
    description: 'Social chat synchronized.',
    schema: {
      example: {
        conversationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        socialId: '44444444-4444-4444-8444-444444444444',
        syncedMemberCount: 8,
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Missing or invalid internal token.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  syncSocial(@Param('socialId') socialId: string, @Body() dto: SyncGroupChatDto) {
    return this.internalService.syncSocial(socialId, dto.memberIds);
  }

  @Post('tournaments/:tournamentId/sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Synchronize tournament chat participants',
    description:
      'Internal endpoint for tournament-service. Ensures a tournament conversation exists and aligns chat participants with current tournament members. Frontend clients should not call this endpoint.',
  })
  @ApiParam({ name: 'tournamentId', example: '55555555-5555-4555-8555-555555555555' })
  @ApiBody({ type: SyncGroupChatDto })
  @ApiOkResponse({
    description: 'Tournament chat synchronized.',
    schema: {
      example: {
        conversationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tournamentId: '55555555-5555-4555-8555-555555555555',
        syncedMemberCount: 32,
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Missing or invalid internal token.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  syncTournament(
    @Param('tournamentId') tournamentId: string,
    @Body() dto: SyncGroupChatDto,
  ) {
    return this.internalService.syncTournament(tournamentId, dto.memberIds);
  }

  @Post('conversations/:conversationId/system-message')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create a system message',
    description:
      'Internal endpoint for service-originated timeline messages. Frontend clients receive the message through normal history and realtime events.',
  })
  @ApiParam({ name: 'conversationId', example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
  @ApiBody({ type: SystemMessageDto })
  @ApiOkResponse({
    description: 'System message created.',
    schema: {
      example: {
        id: '33333333-3333-4333-8333-333333333333',
        conversationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        senderId: '00000000-0000-0000-0000-000000000000',
        sender: null,
        type: 'SYSTEM',
        body: 'A new member joined the group.',
        mediaUrl: null,
        metadata: { eventType: 'GROUP_MEMBER_JOINED' },
        editedAt: null,
        deletedAt: null,
        createdAt: '2026-07-02T10:00:00.000Z',
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Missing or invalid internal token.' })
  @ApiNotFoundResponse({ description: 'Conversation not found.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  createSystemMessage(
    @Param('conversationId') conversationId: string,
    @Body() dto: SystemMessageDto,
  ) {
    return this.internalService.createSystemMessage(
      conversationId,
      dto.body,
      dto.metadata,
    );
  }
}
