import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const uploadPath = path.join(process.cwd(), 'src', 'temp');
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // elimina propiedades no definidas en el DTO
      forbidNonWhitelisted: true, // arroja error si llegan campos extras
      transform: true        // convierte payloads a instancias de clases
    }),
  );
  await app.listen(process.env.PORT ?? 4200);
}
bootstrap();
