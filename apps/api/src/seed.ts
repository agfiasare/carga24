/**
 * Carga inicial de la base. Ver datos-iniciales.ts.
 *
 * Uso: SEED_ADMIN_PASSWORD=... npm run prisma:seed -w @carga24/api
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { cargarDatosIniciales } from './datos-iniciales.js';
import { PrismaClient } from './generated/prisma/client.js';

async function main(): Promise<void> {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    await cargarDatosIniciales(prisma, process.env.SEED_ADMIN_PASSWORD);
    console.log('Carga inicial lista.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
