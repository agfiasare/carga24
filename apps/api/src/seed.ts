/**
 * Carga inicial de la base: perfiles de permisos, plataforma, configuración
 * por defecto y el primer usuario admin. Se puede correr más de una vez.
 *
 * Uso: SEED_ADMIN_PASSWORD=... npm run prisma:seed -w @carga24/api
 */
import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PERFILES_INICIALES } from '@carga24/shared';
import { PrismaClient } from './generated/prisma/client.js';

const CONFIGURACION_INICIAL: Record<string, unknown> = {
  'comision.modo': 'recargo',
  'comision.porcentaje_pb': 500,
  'comision_operadores.porcentaje_pb': 0,
  'comision_operadores.periodo': 'mensual',
  'montos.carga_minima': 100_000,
  'montos.carga_maxima': 50_000_000,
  'montos.retiro_minimo': 200_000,
  'montos.retiro_con_aprobacion_desde': 10_000_000,
  'cuentas.pendientes_maximas': 3,
  'pago.alias': '',
  'pago.titular': '',
  'pago.banco': '',
  'atencion.horario': '',
};

async function main(): Promise<void> {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    for (const [nombre, permisos] of Object.entries(PERFILES_INICIALES)) {
      const perfil = await prisma.perfil.upsert({ where: { nombre }, update: {}, create: { nombre } });
      await prisma.perfilPermiso.createMany({
        data: permisos.map((permiso) => ({ perfilId: perfil.id, permiso })),
        skipDuplicates: true,
      });
    }

    await prisma.plataforma.upsert({ where: { nombre: 'Plataforma principal' }, update: {}, create: { nombre: 'Plataforma principal' } });

    for (const [clave, valor] of Object.entries(CONFIGURACION_INICIAL)) {
      await prisma.configuracion.upsert({ where: { clave }, update: {}, create: { clave, valor: valor as never } });
    }

    const contrasena = process.env.SEED_ADMIN_PASSWORD;
    const admin = await prisma.usuario.findUnique({ where: { nombreUsuario: 'admin' } });
    if (!admin) {
      if (!contrasena || contrasena.length < 12) {
        throw new Error('Definí SEED_ADMIN_PASSWORD (12 caracteres o más) para crear el usuario admin.');
      }
      const perfilAdmin = await prisma.perfil.findUniqueOrThrow({ where: { nombre: 'Admin' } });
      await prisma.usuario.create({
        data: {
          tipo: 'staff',
          nombreUsuario: 'admin',
          nombreVisible: 'Admin',
          contrasenaHash: await hash(contrasena),
          debeCambiarContrasena: true,
          perfilId: perfilAdmin.id,
        },
      });
      console.log('Usuario admin creado. Debe cambiar la contraseña y activar 2FA en su primer ingreso.');
    }
    console.log('Carga inicial lista.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
