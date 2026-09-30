import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/media');
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('PickleHub Media Service')
    .setDescription('REST API for handling media uploads.')
    .setVersion('1.0')
    .addServer('/', 'API Gateway')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(process.env.MEDIA_SERVICE_PORT ?? 8011);
}
bootstrap();
