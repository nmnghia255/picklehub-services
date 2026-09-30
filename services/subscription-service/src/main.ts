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
    .setTitle('PickleHub Subscription Service')
    .setDescription(
      'REST API for managing service packages (Gói dịch vụ) and subscriptions.\n\n' +
        '**Base path:** `/api/subscriptions`\n\n' +
        'Most endpoints require a **Bearer JWT access token** in the `Authorization` header.\n\n' +
        '---\n\n' +
        '### VNPay Sandbox Testing Instructions\n' +
        'To complete a test payment on the frontend, follow these steps when redirected to VNPay:\n\n' +
        '1. Click on the second option: **"Thẻ nội địa và tài khoản ngân hàng"** (Domestic card and bank account).\n' +
        '2. Click on the **NCB** logo (Ngân hàng Quốc Dân).\n' +
        '3. Fill in the test card information exactly as follows:\n' +
        '   - **Số thẻ (Card Number):** `9704198526191432198`\n' +
        '   - **Tên chủ thẻ (Card Holder Name):** `NGUYEN VAN A` (Must be uppercase, no accents)\n' +
        '   - **Ngày phát hành (Issue Date):** `07/15`\n' +
        '4. Click **"Tiếp tục"** (Continue).\n' +
        '5. On the next screen, it will ask for an OTP. Enter `123456`.\n' +
        '6. Click **"Thanh toán"** (Pay).\n\n' +
        'Once you complete this, VNPay will show a success screen and redirect you back to the frontend URL. ' +
        'In the background, VNPay will automatically send an IPN callback to your localtunnel URL, which will hit the backend and update the subscription status to `ACTIVE`.',
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
        name: 'x-internal-token',
        description: 'Internal token for inter-service communication',
      },
      'x-internal-token',
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

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 8012);
}

bootstrap();
