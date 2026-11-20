import { SetMetadata } from '@nestjs/common';
import type { Permiso } from '@carga24/shared';

export const PERMISOS_REQUERIDOS = 'permisosRequeridos';
export const PERMISOS_ALTERNATIVOS = 'permisosAlternativos';

/**
 * Marca una ruta del panel con los permisos que exige (todos).
 * Ejemplo: @RequierePermisos('pedidos.acreditar')
 */
export const RequierePermisos = (...permisos: Permiso[]) => SetMetadata(PERMISOS_REQUERIDOS, permisos);

/** La ruta exige al menos uno de estos permisos. */
export const RequiereAlgunPermiso = (...permisos: Permiso[]) => SetMetadata(PERMISOS_ALTERNATIVOS, permisos);
