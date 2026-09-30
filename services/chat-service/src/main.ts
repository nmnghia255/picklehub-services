import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('PickleHub Chat Service')
    .setDescription(
      'REST and realtime APIs for direct friend chats, group chats, social chats, and tournament chats.\n\n' +
        '**Base path:** `/api/chats`\n\n' +
        '### Socket.IO live integration\n' +
        'Frontend clients should use the standard Socket.IO client:\n' +
        '- **Path:** `/chat.io/`\n' +
        '- **Namespace:** `/chats`\n\n' +
        '**Authentication:** pass the JWT access token on connection:\n' +
        '```js\nconst socket = io("wss://api.picklehub.vn/chats", {\n  path: "/chat.io/",\n  auth: { token: "YOUR_JWT_HERE" }\n});\n```\n\n' +
        '**REST bootstrap flow:**\n' +
        '1. Open or fetch a conversation with `/api/chats/conversations/*`.\n' +
        '2. Load history with `/api/chats/conversations/{conversationId}/messages`.\n' +
        '3. Connect Socket.IO and emit `join-conversation` for live updates.\n\n' +
        '**Emit events (client to server):**\n' +
        '- `join-conversation`: `{ conversationId }` - Join a room to receive live messages.\n' +
        '- `leave-conversation`: `{ conversationId }` - Leave a room.\n' +
        '- `send-message`: `{ conversationId, type, body, mediaUrl, metadata }` - Send a message in real time.\n' +
        '- `typing-start` / `typing-stop`: `{ conversationId }` - Trigger typing indicators.\n' +
        '- `mark-read`: `{ conversationId, messageId }` - Update your read cursor.\n\n' +
        '**Listen events (server to client):**\n' +
        '- `message-created`: Emitted when a new message is sent.\n' +
        '- `message-updated`: Emitted when a message is edited.\n' +
        '- `message-deleted`: Emitted when a message is soft-deleted.\n' +
        '- `message-read`: Emitted when a participant updates their read cursor.\n' +
        '- `typing`: `{ conversationId, userId, isTyping }` - Typing status updates.\n' +
        '- `conversation-updated`: Fired when preview text or unread count needs an update.\n',
    )
    .setVersion('1.0')
    .addServer('/', 'API Gateway')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-internal-token' },
      'x-internal-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 8029);
}

bootstrap();
