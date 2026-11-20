import { SetMetadata } from '@nestjs/common';
import type { Permiso } from '@carga24/shared';

export const PERMISOS_REQUERIDOS = 'permisosRequeridos';

/**
 * Marca una ruta del panel con los permisos que exige.
 * Ejemplo: @RequierePermisos('pedidos.acreditar')
 */
export const RequierePermisos = (...permisos: Permiso[]) => SetMetadata(PERMISOS_REQUERIDOS, permisos);
