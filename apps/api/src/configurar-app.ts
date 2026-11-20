import { ForbiddenException, type INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { FiltroErrores } from './comun/filtro-errores.js';

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function origenesPermitidos(): string[] {
  return (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

/** Configuración común a la app real y a los tests e2e. */
export function configurarApp(app: INestApplication): void {
  const origenes = origenesPermitidos();
  // Detrás de Caddy: la IP real viene en X-Forwarded-For.
  (app.getHttpAdapter().getInstance() as { set(clave: string, valor: unknown): void }).set('trust proxy', 1);
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  // Defensa extra contra CSRF (además de SameSite=Strict): las peticiones que cambian
  // datos y vienen de un navegador tienen que venir de nuestros dominios.
  app.use((peticion: Request, _respuesta: Response, siguiente: NextFunction) => {
    const origen = peticion.get('origin');
    if (!METODOS_SEGUROS.has(peticion.method) && origen && !origenes.includes(origen)) {
      siguiente(new ForbiddenException('Origen no permitido'));
      return;
    }
    siguiente();
  });
  app.enableCors({ origin: origenes, credentials: true });
  app.useGlobalFilters(new FiltroErrores());
}
