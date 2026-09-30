import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class ChatEventsService {
  private server?: Server;

  bindServer(server: Server) {
    this.server = server;
  }

  emitToConversation(conversationId: string, event: string, payload: unknown) {
    this.server?.to(this.roomName(conversationId)).emit(event, payload);
  }

  roomName(conversationId: string) {
    return `conversation_${conversationId}`;
  }
}
