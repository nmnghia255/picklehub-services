import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for API Gateway communication
  app.enableCors();

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  // ─── Swagger ─────────────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('PickleHub Notification Service')
    .setDescription(
      'Internal REST API for sending email and push notifications.\n\n' +
        '**Base path:** `/api`\n\n' +
        'Internal endpoints require an **Internal Service Token** in the `x-internal-service-token` header.\n' +
        'User endpoints require a standard JWT **Bearer Token**.',
    )
    .setVersion('1.0')
    .addServer('/', 'API Gateway')
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-internal-service-token', description: 'Internal service token' },
      'internal-token',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
  // ─────────────────────────────────────────────────────────────────────────

  await app.listen(process.env.PORT ?? 8002);
  console.log(`🚀 Notification service is running on port ${process.env.PORT ?? 8002}`);
}
bootstrap();
