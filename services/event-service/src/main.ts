import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api/events', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  const config = new DocumentBuilder()
    .setTitle('PickleHub Event Service')
    .setDescription(
      'REST API for event management.\n\n' +
        '**Base path:** `/api/events`\n\n' +
        'Endpoints that require authentication expect a **Bearer JWT access token** in the `Authorization` header.',
    )
    .setVersion('1.0')
    .addServer('/', 'API Gateway')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-internal-service-token',
        description: 'Token for inter-service communication',
      },
      'internal-service-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
    const updatedPaths: typeof document.paths = {};
    for (const [pathKey, pathItem] of Object.entries(document.paths ?? {})) {
      let nextPath = pathKey;

      if (pathKey.startsWith('/api/events/play-sessions')) {
        nextPath = pathKey.replace('/api/events/play-sessions', '/api/play-sessions');
      } else if (
        pathKey.startsWith('/api/events/groups/') &&
        pathKey.includes('/play-sessions')
      ) {
        nextPath = pathKey.replace('/api/events/groups/', '/api/groups/');
      }

      updatedPaths[nextPath] = pathItem;
    }

    document.paths = updatedPaths;
    SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 8004);
}

void bootstrap();
