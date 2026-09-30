import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  const config = new DocumentBuilder()
    .setTitle('PickleHub Coach Service')
    .setDescription(
      'REST API for managing coach profiles, certifications, group classes (Phase 2A), and private 1-on-1 bookings (Phase 2B).\n\n' +
        '## Base Paths\n\n' +
        '| Prefix | Who | Purpose |\n' +
        '|---|---|---|\n' +
        '| `/api/coach/*` | Authenticated Coach | Self-management (own profile, classes, bookings) |\n' +
        '| `/api/coaches/*` | Anyone | Public discovery (coach list, class list, booking requests) |\n' +
        '| `/api/learner/*` | Authenticated Learner | Learner-side enrollment & booking management |\n' +
        '| `/api/learner/schedule` | Authenticated Learner | Combined learning schedule across class sessions and private bookings |\n' +
        '| `/api/classes/*` | Anyone / Learner | Public class discovery & enrollment |\n' +
        '| `/api/admin/coaches/*` | Admin | Certification review |\n\n' +
        'Most write endpoints require a **Bearer JWT access token** in the `Authorization` header.\n\n' +
        '---\n\n' +
        '## Payment Model\n\n' +
        'This service uses **direct bank transfer** — no payment gateway. Bank account details (`paymentAccountName`, `paymentAccountNumber`, `paymentBankName`, `paymentQrUrl`) are stored on `CoachProfile` and returned automatically after enrollment or booking confirmation.\n\n' +
        '**Integration flow guides and status transition diagrams are documented on the key entry-point endpoints** — see `POST /api/classes/:classId/enroll` and `POST /api/coaches/:coachId/bookings`.',
    )
    .setVersion('1.0')
    .addServer('/', 'API Gateway')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-internal-token' },
      'internal-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 8019);
}

bootstrap();
