import type { Permiso } from '@carga24/shared';

/** Lo que el middleware de sesión deja en `request.usuario` (Sprint 1). */
export interface UsuarioAutenticado {
  id: string;
  tipo: 'jugador' | 'staff';
  /** Permisos efectivos: los del perfil + ajustes individuales. Vacío para jugadores. */
  permisos: ReadonlySet<Permiso>;
}
