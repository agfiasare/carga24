import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { expect } from 'vitest';
import { AppModule } from '../app.module.js';
import { configurarApp } from '../configurar-app.js';
import { generarCodigo } from '../comun/totp.js';
import { cargarDatosIniciales } from '../datos-iniciales.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const CONTRASENA_ADMIN = 'admin-de-prueba-123';

/** Levanta la API completa sobre una base vacía con los datos iniciales. */
export async function crearAppDePrueba(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const url = process.env.DATABASE_URL ?? '';
  if (!/_test(\?|$)/.test(url)) {
    throw new Error(`Los tests e2e borran la base. DATABASE_URL no parece una base de prueba: ${url}`);
  }
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = modulo.createNestApplication({ logger: false });
  configurarApp(app);
  await app.init();
  const prisma = app.get(PrismaService);
  const tablas = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tablas.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  await cargarDatosIniciales(prisma, CONTRASENA_ADMIN);
  return { app, prisma };
}

export type Agente = ReturnType<typeof request.agent>;

export function agente(app: INestApplication): Agente {
  return request.agent(app.getHttpServer());
}

/**
 * Hace el ingreso completo de una persona del staff (contraseña temporal → nueva → 2FA).
 * Devuelve el secreto de 2FA para volver a ingresar.
 */
export async function primerIngresoStaff(cliente: Agente, usuario: string, temporal: string, nueva: string): Promise<string> {
  const ingreso = await cliente.post('/api/v1/auth/staff/ingreso').send({ identificador: usuario, contrasena: temporal });
  expect(ingreso.body).toEqual({ siguientePaso: 'cambiar_contrasena' });
  const cambio = await cliente.post('/api/v1/auth/staff/contrasena-inicial').send({ nueva });
  expect(cambio.body).toEqual({ siguientePaso: 'configurar_2fa' });
  const { body } = await cliente.post('/api/v1/auth/staff/2fa/configurar').expect(200);
  await cliente.post('/api/v1/auth/staff/2fa/activar').send({ codigo: generarCodigo(body.secreto) }).expect(200);
  return body.secreto as string;
}

/** Abre un turno: sin turno el staff no opera pedidos. */
export async function abrirTurno(cliente: Agente): Promise<void> {
  await cliente.post('/api/v1/turnos').expect(201);
}

export async function ingresarStaff(cliente: Agente, usuario: string, contrasena: string, secreto: string): Promise<void> {
  const ingreso = await cliente.post('/api/v1/auth/staff/ingreso').send({ identificador: usuario, contrasena }).expect(200);
  expect(ingreso.body).toEqual({ siguientePaso: 'verificar_2fa' });
  await cliente.post('/api/v1/auth/staff/2fa/verificar').send({ codigo: generarCodigo(secreto) }).expect(200);
}
