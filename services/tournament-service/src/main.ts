import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/tournaments', {
    exclude: ['api-docs', 'api-docs-json', 'health'],
  });
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('PickleHub Tournament Service')
    .setDescription(
      'REST API for tournament management.\n\n' +
        '**Base path:** `/api/tournaments`\n\n' +
        'Authenticated endpoints expect a Bearer JWT access token in the `Authorization` header.',
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

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 8008);
}

void bootstrap();