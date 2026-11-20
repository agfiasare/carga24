import { esPermiso, permisosEfectivos, type Permiso } from '@carga24/shared';

interface StaffConPermisos {
  perfil: { permisos: { permiso: string }[] } | null;
  ajustesPermisos: { permiso: string; tipo: 'agregar' | 'quitar' }[];
}

/** Permisos efectivos de una persona del staff (ignora claves que ya no estén en el catálogo). */
export function permisosDe(staff: StaffConPermisos): Set<Permiso> {
  return permisosEfectivos(
    (staff.perfil?.permisos ?? []).map((p) => p.permiso).filter(esPermiso),
    staff.ajustesPermisos.flatMap((a) => (esPermiso(a.permiso) ? [{ permiso: a.permiso, tipo: a.tipo }] : [])),
  );
}

/** Para los `include` de Prisma que necesitan calcular permisos. */
export const INCLUIR_PERMISOS = { perfil: { include: { permisos: true } }, ajustesPermisos: true } as const;
