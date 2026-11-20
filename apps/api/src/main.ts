import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configurarApp } from './configurar-app.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configurarApp(app);
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
