import type { Request } from 'express';
import type { Permiso } from '@carga24/shared';

/** Lo que el guard de autenticación deja en `request.usuario`. */
export interface UsuarioAutenticado {
  id: string;
  tipo: 'jugador' | 'staff';
  /** Permisos efectivos: los del perfil + ajustes individuales. Vacío para jugadores. */
  permisos: ReadonlySet<Permiso>;
  sesionId: string;
  /** Staff: 'pendiente' mientras le falta cambiar la contraseña o el 2FA. */
  nivel: 'pendiente' | 'completa';
  debeCambiarContrasena: boolean;
}

export interface Peticion extends Request {
  usuario?: UsuarioAutenticado;
}
