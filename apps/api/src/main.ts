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
  if (process.env.DOS_FACTORES?.trim().toLowerCase() === 'no') {
    console.warn('AVISO: DOS_FACTORES=no — el staff ingresa sin código de verificación. Usalo solo para pruebas.');
  }
}

void bootstrap();
