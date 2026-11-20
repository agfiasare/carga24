import { ConflictException } from '@nestjs/common';
import { INCLUIR_PERMISOS, permisosDe } from '../auth/permisos-usuario.js';
import type { PrismaService } from '../prisma/prisma.service.js';

/**
 * Evita que el sistema quede sin nadie que pueda administrar: después de cualquier cambio de
 * perfiles, ajustes o bloqueos tiene que quedar al menos una persona del staff activa con
 * "staff.gestionar" y "perfiles.gestionar". Se llama dentro de la transacción del cambio;
 * si falla, el cambio se deshace.
 */
export async function verificarQueQuedaAdministrador(tx: Pick<PrismaService, 'usuario'>): Promise<void> {
  const activos = await tx.usuario.findMany({ where: { tipo: 'staff', estado: 'activo' }, include: INCLUIR_PERMISOS });
  const hayAdministrador = activos.some((s) => {
    const permisos = permisosDe(s);
    return permisos.has('staff.gestionar') && permisos.has('perfiles.gestionar');
  });
  if (!hayAdministrador) {
    throw new ConflictException('Con este cambio nadie podría administrar el staff y los perfiles. Dejá al menos una persona con esos permisos.');
  }
}
