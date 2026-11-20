import type { Permiso } from '@carga24/shared';
import { api } from './cliente';

export type EstadoUsuario = 'activo' | 'bloqueado';

export interface JugadorPanel {
  id: string;
  nombreUsuario: string | null;
  telefono: string | null;
  usuarioPlataforma: string | null;
  estado: EstadoUsuario;
  debeCambiarContrasena: boolean;
  creadoEn: string;
  notasInternas?: string | null;
}

export interface ListadoJugadores {
  total: number;
  pagina: number;
  porPagina: number;
  jugadores: JugadorPanel[];
}

export interface DatosJugador {
  usuarioPlataforma?: string;
  telefono?: string | null;
  nombreUsuario?: string | null;
  notasInternas?: string | null;
}

export interface AjustePermiso {
  permiso: Permiso;
  tipo: 'agregar' | 'quitar';
}

export interface StaffPanel {
  id: string;
  nombreUsuario: string | null;
  nombreVisible: string | null;
  estado: EstadoUsuario;
  perfil: { id: string; nombre: string } | null;
  ajustes: AjustePermiso[];
  permisos: Permiso[];
  tiene2fa: boolean;
  debeCambiarContrasena: boolean;
  comisionOperadorPb: number | null;
  creadoEn: string;
}

export interface DatosStaff {
  nombreVisible?: string;
  perfilId?: string;
  comisionOperadorPb?: number | null;
  estado?: EstadoUsuario;
}

export interface Perfil {
  id: string;
  nombre: string;
  descripcion: string | null;
  permisos: Permiso[];
  cantidadUsuarios: number;
}

export interface DatosPerfil {
  nombre: string;
  descripcion?: string | null;
  permisos: Permiso[];
}

const id = encodeURIComponent;

export const jugadores = {
  listar: (buscar: string, pagina: number) =>
    api<ListadoJugadores>('GET', `/jugadores?${new URLSearchParams({ ...(buscar ? { buscar } : {}), pagina: String(pagina) }).toString()}`),
  obtener: (jugadorId: string) => api<JugadorPanel>('GET', `/jugadores/${id(jugadorId)}`),
  crear: (datos: DatosJugador & { usuarioPlataforma: string }) =>
    api<{ jugador: JugadorPanel; contrasenaTemporal: string }>('POST', '/jugadores', datos),
  editar: (jugadorId: string, datos: DatosJugador) => api<JugadorPanel>('PATCH', `/jugadores/${id(jugadorId)}`, datos),
  bloquear: (jugadorId: string) => api<JugadorPanel>('POST', `/jugadores/${id(jugadorId)}/bloquear`),
  desbloquear: (jugadorId: string) => api<JugadorPanel>('POST', `/jugadores/${id(jugadorId)}/desbloquear`),
  resetearContrasena: (jugadorId: string) => api<{ contrasenaTemporal: string }>('POST', `/jugadores/${id(jugadorId)}/resetear-contrasena`),
  cuentas: (jugadorId: string) => api<CuentaJugador[]>('GET', `/jugadores/${id(jugadorId)}/cuentas`),
};

export interface CuentaJugador {
  id: string;
  cbuCvu: string;
  alias: string | null;
  banco: string | null;
  titular: string | null;
  estado: 'pendiente' | 'verificada' | 'rechazada';
}

export const staff = {
  listar: () => api<StaffPanel[]>('GET', '/staff'),
  obtener: (staffId: string) => api<StaffPanel>('GET', `/staff/${id(staffId)}`),
  crear: (datos: { nombreUsuario: string; nombreVisible: string; perfilId: string; ajustes?: AjustePermiso[] }) =>
    api<{ staff: StaffPanel; contrasenaTemporal: string }>('POST', '/staff', datos),
  editar: (staffId: string, datos: DatosStaff) => api<StaffPanel>('PATCH', `/staff/${id(staffId)}`, datos),
  ajustes: (staffId: string, ajustes: AjustePermiso[]) => api<StaffPanel>('PUT', `/staff/${id(staffId)}/ajustes`, { ajustes }),
  resetearContrasena: (staffId: string) => api<{ contrasenaTemporal: string }>('POST', `/staff/${id(staffId)}/resetear-contrasena`),
  resetear2fa: (staffId: string) => api<void>('POST', `/staff/${id(staffId)}/resetear-2fa`),
};

export const perfiles = {
  listar: () => api<Perfil[]>('GET', '/perfiles'),
  crear: (datos: DatosPerfil) => api<Perfil>('POST', '/perfiles', datos),
  editar: (perfilId: string, datos: DatosPerfil) => api<Perfil>('PUT', `/perfiles/${id(perfilId)}`, datos),
  eliminar: (perfilId: string) => api<void>('DELETE', `/perfiles/${id(perfilId)}`),
};

/** Ajustes individuales = diferencia entre lo elegido y lo que da el perfil. */
export function calcularAjustes(elegidos: ReadonlySet<Permiso>, delPerfil: ReadonlySet<Permiso>): AjustePermiso[] {
  const ajustes: AjustePermiso[] = [];
  for (const p of elegidos) if (!delPerfil.has(p)) ajustes.push({ permiso: p, tipo: 'agregar' });
  for (const p of delPerfil) if (!elegidos.has(p)) ajustes.push({ permiso: p, tipo: 'quitar' });
  return ajustes;
}
