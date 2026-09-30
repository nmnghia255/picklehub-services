import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { BOOKING_TIMEOUT_MINUTES } from './booking/booking-timeout.service';

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

  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  const config = new DocumentBuilder()
    .setTitle('PickleHub Sport Center Service')
    .setDescription(
      'REST API for sport center and court management.\n\n' +
      '**Base path:** `/api`\n\n' +
      'Endpoints that require authentication expect a **Bearer JWT access token** in the `Authorization` header.\n\n' +
      '---\n\n' +
      '## 🔑 Seed User Accounts (For Testing & Frontend Dev)\n\n' +
      'Use the following seeded accounts in the **Auth Service** to get your JWT access tokens:\n\n' +
      '- **👤 Normal User Account:**\n' +
      '  - **Email:** `seed-user@picklehub.com`\n' +
      '  - **Password:** `Picklehub123!`\n' +
      '- **🏢 Sport Center Owner Account:**\n' +
      '  - **Email:** `seed-owner@picklehub.com`\n' +
      '  - **Password:** `Picklehub123!`\n\n' +
      '---\n\n' +
      '## ⏱️ Booking Payment Timeout\n\n' +
      `A **PENDING** booking will be **automatically cancelled** if no payment proof is uploaded within **${BOOKING_TIMEOUT_MINUTES} minutes** of creation. ` +
      'The system runs a background check every minute.\n\n' +
      '**What happens on timeout:**\n' +
      '- Booking status → `CANCELLED` (reason: `PAYMENT_TIMEOUT`)\n' +
      '- Reserved court slots are released back to availability\n' +
      '- Product stock is restored\n' +
      '- Any pre-applied preservation credit is fully refunded back to the player\'s wallet\n' +
      '- Player receives an in-app + email notification\n\n' +
      '**Frontend integration:**\n' +
      '- The `POST /bookings` response includes the following fields when the status is `PENDING`:\n' +
      '  - `expiresAt`: The precise ISO timestamp of when the booking will expire (e.g. `2026-05-06T08:10:00.000Z`). **Use this to calculate and display a live countdown timer**.\n' +
      '  - `bookingTimeoutMinutes`: The timeout duration in minutes (e.g. `10`). **Use this to display static helper hints** like *"You have 10 minutes to pay and upload your receipt."*\n' +
      '- Both fields will be `null` if the booking is fully paid with credit and auto-confirmed instantly at creation time.\n',
    )
    .setVersion('1.0')
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
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 8007);
}

void bootstrap();
