import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Logger, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsAuthGuard } from '../guards/ws-auth.guard';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesService } from '../messages/messages.service';
import { ChatEventsService } from './chat-events.service';
import {
  ConversationEventDto,
  RealtimeMarkReadDto,
  RealtimeSendMessageDto,
} from './dto/realtime.dto';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chats',
  path: '/chat.io/',
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly chatEvents: ChatEventsService,
  ) {}

  afterInit(server: Server) {
    this.chatEvents.bindServer(server);
    this.logger.log('ChatGateway initialised on namespace /chats path /chat.io/');
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Chat client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Chat client disconnected: ${client.id}`);
  }

  @UseGuards(WsAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @SubscribeMessage('join-conversation')
  async handleJoinConversation(
    @MessageBody() payload: ConversationEventDto,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.getUserId(client);
    await this.conversationsService.findAccessibleConversation(
      userId,
      payload.conversationId,
    );
    const room = this.chatEvents.roomName(payload.conversationId);
    await client.join(room);
    return { joined: room, conversationId: payload.conversationId };
  }

  @UseGuards(WsAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @SubscribeMessage('leave-conversation')
  async handleLeaveConversation(
    @MessageBody() payload: ConversationEventDto,
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.chatEvents.roomName(payload.conversationId);
    await client.leave(room);
    return { left: room, conversationId: payload.conversationId };
  }

  @UseGuards(WsAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @SubscribeMessage('send-message')
  async handleSendMessage(
    @MessageBody() payload: RealtimeSendMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.getUserId(client);
    return this.messagesService.sendMessage(userId, payload.conversationId, {
      type: payload.type,
      body: payload.body,
      mediaUrl: payload.mediaUrl,
      metadata: payload.metadata,
    });
  }

  @UseGuards(WsAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @SubscribeMessage('typing-start')
  async handleTypingStart(
    @MessageBody() payload: ConversationEventDto,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.getUserId(client);
    await this.conversationsService.findAccessibleConversation(
      userId,
      payload.conversationId,
    );
    this.chatEvents.emitToConversation(payload.conversationId, 'typing', {
      conversationId: payload.conversationId,
      userId,
      isTyping: true,
    });
    return { conversationId: payload.conversationId, isTyping: true };
  }

  @UseGuards(WsAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @SubscribeMessage('typing-stop')
  async handleTypingStop(
    @MessageBody() payload: ConversationEventDto,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.getUserId(client);
    await this.conversationsService.findAccessibleConversation(
      userId,
      payload.conversationId,
    );
    this.chatEvents.emitToConversation(payload.conversationId, 'typing', {
      conversationId: payload.conversationId,
      userId,
      isTyping: false,
    });
    return { conversationId: payload.conversationId, isTyping: false };
  }

  @UseGuards(WsAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @SubscribeMessage('mark-read')
  async handleMarkRead(
    @MessageBody() payload: RealtimeMarkReadDto,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.getUserId(client);
    const response = await this.conversationsService.markRead(
      userId,
      payload.conversationId,
      payload.messageId,
    );
    this.chatEvents.emitToConversation(payload.conversationId, 'message-read', response);
    return response;
  }

  private getUserId(client: Socket) {
    const userId = (client as any).user?.sub;
    if (!userId) throw new WsException('Unauthorized');
    return userId;
  }
}
