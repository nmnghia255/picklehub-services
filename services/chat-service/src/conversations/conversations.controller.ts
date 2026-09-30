import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ConversationsService } from './conversations.service';
import { CreateDirectConversationDto } from './dto/create-direct-conversation.dto';
import { CreateGroupConversationDto } from './dto/create-group-conversation.dto';
import { CreateSocialConversationDto } from './dto/create-social-conversation.dto';
import { CreateTournamentConversationDto } from './dto/create-tournament-conversation.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { MuteConversationDto } from './dto/mute-conversation.dto';

const conversationExample = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  type: 'DIRECT',
  groupId: null,
  socialId: null,
  tournamentId: null,
  group: null,
  social: null,
  tournament: null,
  participants: [
    {
      userId: '11111111-1111-4111-8111-111111111111',
      role: 'MEMBER',
      mutedUntil: null,
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Nguyen An',
        email: 'an@example.com',
        role: 'USER',
      },
    },
  ],
  lastMessage: {
    id: '33333333-3333-4333-8333-333333333333',
    senderId: '11111111-1111-4111-8111-111111111111',
    type: 'TEXT',
    body: 'See you at 7pm.',
    mediaUrl: null,
    createdAt: '2026-07-02T10:00:00.000Z',
  },
  unreadCount: 2,
  lastMessageAt: '2026-07-02T10:00:00.000Z',
  createdAt: '2026-07-02T09:00:00.000Z',
  updatedAt: '2026-07-02T10:00:00.000Z',
};

@ApiTags('Chat Conversations')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('api/chats/conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List my chat conversations',
    description:
      'Returns the authenticated user inbox. Frontend clients use this endpoint to render the chat list, unread badges, last message preview, participant names, and group metadata.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiOkResponse({
    description: 'Paginated conversations for the current user.',
    schema: {
      example: {
        data: [conversationExample],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT access token.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  listConversations(
    @Request() req: { user?: { sub?: string } },
    @Query() query: ListConversationsQueryDto,
  ) {
    return this.conversationsService.listConversations(req.user?.sub ?? '', query);
  }

  @Post('direct')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Open a direct friend conversation',
    description:
      'Creates or returns a 1:1 direct conversation with a friend. Frontend clients call this from a friend profile, friend list, or message button before navigating to the chat thread.',
  })
  @ApiBody({ type: CreateDirectConversationDto })
  @ApiOkResponse({
    description: 'Direct conversation was created or already existed.',
    schema: { example: conversationExample },
  })
  @ApiBadRequestResponse({ description: 'Invalid target user ID or caller attempted to message themselves.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT access token.' })
  @ApiForbiddenResponse({ description: 'Caller and target user are not friends.' })
  @ApiNotFoundResponse({ description: 'Target user not found.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  createDirect(
    @Request() req: { user?: { sub?: string } },
    @Body() dto: CreateDirectConversationDto,
  ) {
    return this.conversationsService.createDirectConversation(req.user?.sub ?? '', dto.userId);
  }

  @Post('group')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Open a group conversation',
    description:
      'Creates or returns the chat conversation for a group. Frontend clients call this when a user opens the chat tab inside a group. The caller must be a current group member.',
  })
  @ApiBody({ type: CreateGroupConversationDto })
  @ApiOkResponse({
    description: 'Group conversation was created or already existed.',
    schema: {
      example: {
        ...conversationExample,
        type: 'GROUP',
        groupId: '22222222-2222-4222-8222-222222222222',
        group: {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'District 1 Pickleball',
          maxMembers: 50,
          memberCount: 12,
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid group ID.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT access token.' })
  @ApiForbiddenResponse({ description: 'Caller is not a group member.' })
  @ApiNotFoundResponse({ description: 'Group not found.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  createGroup(
    @Request() req: { user?: { sub?: string } },
    @Body() dto: CreateGroupConversationDto,
  ) {
    return this.conversationsService.createGroupConversation(req.user?.sub ?? '', dto.groupId);
  }

  @Post('social')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Open a social conversation',
    description:
      'Creates or returns the chat conversation for a social. Frontend clients call this from a social detail or play-session screen. The caller must be the social host or a confirmed participant.',
  })
  @ApiBody({ type: CreateSocialConversationDto })
  @ApiOkResponse({
    description: 'Social conversation was created or already existed.',
    schema: {
      example: {
        ...conversationExample,
        type: 'SOCIAL',
        groupId: null,
        socialId: '44444444-4444-4444-8444-444444444444',
        tournamentId: null,
        group: null,
        social: {
          id: '44444444-4444-4444-8444-444444444444',
          title: 'Morning Pickleball Session',
          status: 'PUBLISHED',
          creatorId: '11111111-1111-4111-8111-111111111111',
          joinedCount: 8,
        },
        tournament: null,
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid social ID.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT access token.' })
  @ApiForbiddenResponse({ description: 'Caller is not allowed to access this social.' })
  @ApiNotFoundResponse({ description: 'Social not found.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  createSocial(
    @Request() req: { user?: { sub?: string } },
    @Body() dto: CreateSocialConversationDto,
  ) {
    return this.conversationsService.createSocialConversation(req.user?.sub ?? '', dto.socialId);
  }

  @Post('tournament')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Open a tournament conversation',
    description:
      'Creates or returns the chat conversation for a tournament. Frontend clients call this from tournament screens. The caller must be an organizer, approved participant, referee, or admin.',
  })
  @ApiBody({ type: CreateTournamentConversationDto })
  @ApiOkResponse({
    description: 'Tournament conversation was created or already existed.',
    schema: {
      example: {
        ...conversationExample,
        type: 'TOURNAMENT',
        groupId: null,
        socialId: null,
        tournamentId: '55555555-5555-4555-8555-555555555555',
        group: null,
        social: null,
        tournament: {
          id: '55555555-5555-4555-8555-555555555555',
          name: 'PickleHub Open',
          status: 'published',
          organizerId: '11111111-1111-4111-8111-111111111111',
          registered: 24,
          capacity: 64,
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid tournament ID.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT access token.' })
  @ApiForbiddenResponse({ description: 'Caller is not allowed to access this tournament.' })
  @ApiNotFoundResponse({ description: 'Tournament not found.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  createTournament(
    @Request() req: { user?: { sub?: string } },
    @Body() dto: CreateTournamentConversationDto,
  ) {
    return this.conversationsService.createTournamentConversation(
      req.user?.sub ?? '',
      dto.tournamentId,
    );
  }

  @Get(':conversationId')
  @ApiOperation({
    summary: 'Get conversation details',
    description:
      'Returns one conversation if the caller can access it. Frontend clients use this to hydrate the chat header, participant list, mute state, and unread state.',
  })
  @ApiParam({ name: 'conversationId', example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
  @ApiOkResponse({
    description: 'Conversation details.',
    schema: { example: conversationExample },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT access token.' })
  @ApiForbiddenResponse({ description: 'Caller cannot access this conversation.' })
  @ApiNotFoundResponse({ description: 'Conversation not found.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  getConversation(
    @Request() req: { user?: { sub?: string } },
    @Param('conversationId') conversationId: string,
  ) {
    return this.conversationsService.getConversation(req.user?.sub ?? '', conversationId);
  }

  @Post(':conversationId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark a conversation as read',
    description:
      'Stores the caller read cursor for a conversation. Frontend clients should call this when the thread is visible through the latest rendered message.',
  })
  @ApiParam({ name: 'conversationId', example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
  @ApiBody({ type: MarkReadDto })
  @ApiOkResponse({
    description: 'Read cursor updated.',
    schema: {
      example: {
        conversationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        userId: '11111111-1111-4111-8111-111111111111',
        lastReadMessageId: '33333333-3333-4333-8333-333333333333',
        lastReadAt: '2026-07-02T10:00:00.000Z',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid message ID.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT access token.' })
  @ApiForbiddenResponse({ description: 'Caller cannot access this conversation.' })
  @ApiNotFoundResponse({ description: 'Conversation or message not found.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  markRead(
    @Request() req: { user?: { sub?: string } },
    @Param('conversationId') conversationId: string,
    @Body() dto: MarkReadDto,
  ) {
    return this.conversationsService.markRead(req.user?.sub ?? '', conversationId, dto.messageId);
  }

  @Patch(':conversationId/mute')
  @ApiOperation({
    summary: 'Mute or unmute a conversation',
    description:
      'Updates only the caller participant state. Frontend clients can send an ISO timestamp to mute until a time, or null to unmute.',
  })
  @ApiParam({ name: 'conversationId', example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
  @ApiBody({ type: MuteConversationDto })
  @ApiOkResponse({
    description: 'Mute state updated.',
    schema: {
      example: {
        conversationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        userId: '11111111-1111-4111-8111-111111111111',
        mutedUntil: '2026-07-03T10:00:00.000Z',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid mutedUntil value.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT access token.' })
  @ApiForbiddenResponse({ description: 'Caller cannot access this conversation.' })
  @ApiNotFoundResponse({ description: 'Conversation not found.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  mute(
    @Request() req: { user?: { sub?: string } },
    @Param('conversationId') conversationId: string,
    @Body() dto: MuteConversationDto,
  ) {
    return this.conversationsService.mute(req.user?.sub ?? '', conversationId, dto.mutedUntil);
  }

  @Delete(':conversationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hide a conversation from my inbox',
    description:
      'Soft-deletes the participant row for the caller only. Messages and other participants remain intact. Frontend clients use this for local conversation removal.',
  })
  @ApiParam({ name: 'conversationId', example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
  @ApiOkResponse({
    description: 'Conversation hidden for the current user.',
    schema: { example: { message: 'Conversation hidden successfully.' } },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT access token.' })
  @ApiForbiddenResponse({ description: 'Caller cannot access this conversation.' })
  @ApiNotFoundResponse({ description: 'Conversation not found.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  hide(
    @Request() req: { user?: { sub?: string } },
    @Param('conversationId') conversationId: string,
  ) {
    return this.conversationsService.hide(req.user?.sub ?? '', conversationId);
  }
}
