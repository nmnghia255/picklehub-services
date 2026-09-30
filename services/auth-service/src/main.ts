import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/auth', {
    exclude: [
      // Health check
      { path: 'health', method: RequestMethod.GET },
      // Group routes
      { path: 'api/groups', method: RequestMethod.POST },
      { path: 'api/groups', method: RequestMethod.GET },
      { path: 'api/groups/:id', method: RequestMethod.GET },
      // Group member routes
      { path: 'api/groups/:groupId/members', method: RequestMethod.GET },
      { path: 'api/groups/:groupId/members/:userId', method: RequestMethod.PATCH },
      { path: 'api/groups/:groupId/members/:userId', method: RequestMethod.DELETE },
      // Invitation routes — email invite
      { path: 'api/groups/:groupId/invitations', method: RequestMethod.POST },
      { path: 'api/groups/:groupId/invitations', method: RequestMethod.GET },
      { path: 'api/groups/:groupId/invitations/:invitationId', method: RequestMethod.DELETE },
      { path: 'api/invitations/:token', method: RequestMethod.GET },
      { path: 'api/invitations/:token/accept', method: RequestMethod.POST },
      { path: 'api/invitations/:token/join', method: RequestMethod.POST },
      // Referee Invitation routes
      { path: 'api/referee-invitations/:token', method: RequestMethod.GET },
      { path: 'api/referee-invitations/:token/accept', method: RequestMethod.POST },
      { path: 'api/referee-invitations/:token/join', method: RequestMethod.POST },
      // Invitation routes — shareable invite link
      { path: 'api/groups/:groupId/invite-links', method: RequestMethod.POST },
      { path: 'api/groups/:groupId/invite-links', method: RequestMethod.GET },
      { path: 'api/groups/:groupId/invite-links/:invitationId', method: RequestMethod.DELETE },
      { path: 'api/invitations/:token/magic-link', method: RequestMethod.POST },
      { path: 'api/invitations/magic', method: RequestMethod.POST },
    ],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // ─── Swagger ─────────────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('PickleHub Auth Service')
    .setDescription(
      'REST API for user authentication and authorisation.\n\n' +
      '**Base path:** `/api/auth`\n\n' +
      'Endpoints that require authentication expect a **Bearer JWT access token** ' +
      'in the `Authorization` header.\n\n' +
      'Access tokens expire in **15 minutes**. Use `/api/auth/refresh` to obtain ' +
      'a new access token with your refresh token (valid for **7 days**).',
    )
    .setVersion('1.0')
    .addServer('/', 'API Gateway')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
  // ─────────────────────────────────────────────────────────────────────────

  await app.listen(process.env.AUTH_SERVICE_PORT ?? 8001);
}
bootstrap();
