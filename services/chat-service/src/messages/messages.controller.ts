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
  ApiCreatedResponse,
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
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { MessagesService } from './messages.service';

const messageExample = {
  id: '33333333-3333-4333-8333-333333333333',
  conversationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  senderId: '11111111-1111-4111-8111-111111111111',
  sender: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Nguyen An',
    email: 'an@example.com',
    role: 'USER',
  },
  type: 'TEXT',
  body: 'See you at 7pm.',
  mediaUrl: null,
  metadata: null,
  editedAt: null,
  deletedAt: null,
  createdAt: '2026-07-02T10:00:00.000Z',
};

@ApiTags('Chat Messages')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('api/chats/conversations/:conversationId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @ApiOperation({
    summary: 'List conversation messages',
    description:
      'Returns message history for a conversation the caller can access.\n\n' +
      '**Pagination mode** (default): cursor-based, newest-first. Pass `nextBefore` from the previous response as `before` to load older messages (infinite scroll upward).\n\n' +
      '**Search mode**: provide `search` keyword to filter messages by body text. The `before` cursor is ignored in search mode and `nextBefore` will always be `null`.',
  })
  @ApiParam({ name: 'conversationId', example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
  @ApiQuery({
    name: 'before',
    required: false,
    description: 'Message ID cursor. Returns messages created before this message. Ignored when `search` is set.',
    example: '33333333-3333-4333-8333-333333333333',
  })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Keyword to search in message body (case-insensitive). When set, cursor pagination is disabled.',
    example: 'court booking',
  })
  @ApiOkResponse({
    description: 'Paginated message history.',
    schema: {
      example: {
        data: [messageExample],
        meta: {
          limit: 50,
          nextBefore: '33333333-3333-4333-8333-333333333333',
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid cursor or pagination query.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT access token.' })
  @ApiForbiddenResponse({ description: 'Caller cannot access this conversation.' })
  @ApiNotFoundResponse({ description: 'Conversation or cursor message not found.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  listMessages(
    @Request() req: { user?: { sub?: string } },
    @Param('conversationId') conversationId: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.messagesService.listMessages(req.user?.sub ?? '', conversationId, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Send a chat message',
    description:
      'Creates a text or media-link message, updates conversation preview state, emits realtime events, and notifies unmuted recipients. Frontend clients can use this REST endpoint as a reliable fallback to Socket.IO `send-message`.',
  })
  @ApiParam({ name: 'conversationId', example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
  @ApiBody({ type: SendMessageDto })
  @ApiCreatedResponse({
    description: 'Message created.',
    schema: { example: messageExample },
  })
  @ApiBadRequestResponse({ description: 'Invalid message body, type, or media URL.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT access token.' })
  @ApiForbiddenResponse({ description: 'Caller cannot send to this conversation.' })
  @ApiNotFoundResponse({ description: 'Conversation not found.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  sendMessage(
    @Request() req: { user?: { sub?: string } },
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(req.user?.sub ?? '', conversationId, dto);
  }

  @Patch(':messageId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Edit a message',
    description:
      'Updates the body of a TEXT message sent by the caller. Sets `editedAt` timestamp. Broadcasts a `message-updated` Socket.IO event to all conversation room members so the UI updates in real-time.',
  })
  @ApiParam({ name: 'conversationId', example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
  @ApiParam({ name: 'messageId', example: '33333333-3333-4333-8333-333333333333' })
  @ApiBody({ type: EditMessageDto })
  @ApiOkResponse({
    description: 'Message updated.',
    schema: {
      example: {
        ...messageExample,
        body: 'See you at 8pm instead!',
        editedAt: '2026-07-02T10:05:00.000Z',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid body.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT access token.' })
  @ApiForbiddenResponse({ description: 'You can only edit your own TEXT messages.' })
  @ApiNotFoundResponse({ description: 'Message not found.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  editMessage(
    @Request() req: { user?: { sub?: string } },
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.messagesService.editMessage(req.user?.sub ?? '', conversationId, messageId, dto);
  }

  @Delete(':messageId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a message',
    description:
      'Soft-deletes a message sent by the caller (sets `deletedAt`). The message body is no longer returned in history. Broadcasts a `message-deleted` Socket.IO event so all connected clients can remove it from their local state immediately.',
  })
  @ApiParam({ name: 'conversationId', example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
  @ApiParam({ name: 'messageId', example: '33333333-3333-4333-8333-333333333333' })
  @ApiOkResponse({
    description: 'Message deleted.',
    schema: { example: { message: 'Message deleted.' } },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT access token.' })
  @ApiForbiddenResponse({ description: 'You can only delete your own messages.' })
  @ApiNotFoundResponse({ description: 'Message not found.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  deleteMessage(
    @Request() req: { user?: { sub?: string } },
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.messagesService.deleteMessage(req.user?.sub ?? '', conversationId, messageId);
  }
}

