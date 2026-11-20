import { api } from './cliente';

export interface Jugador {
  id: string;
  nombreUsuario: string | null;
  telefono: string | null;
  usuarioPlataforma: string | null;
  debeCambiarContrasena: boolean;
}

export interface StaffYo {
  id: string;
  nombreUsuario: string | null;
  nombreVisible: string | null;
  perfil: { id: string; nombre: string } | null;
  permisos: string[];
}

export type PasoIngresoStaff = 'cambiar_contrasena' | 'configurar_2fa' | 'verificar_2fa';

export interface DatosRegistro {
  usuarioPlataforma: string;
  telefono: string;
  nombreUsuario: string;
  contrasena: string;
  mayorDeEdad: boolean;
}

export const authJugador = {
  registrar: (datos: DatosRegistro) => api<Jugador>('POST', '/auth/jugador/registro', datos),
  ingresar: (identificador: string, contrasena: string) => api<Jugador>('POST', '/auth/jugador/ingreso', { identificador, contrasena }),
  salir: () => api<void>('POST', '/auth/jugador/salir'),
  yo: () => api<Jugador>('GET', '/yo'),
  cambiarContrasena: (actual: string, nueva: string) => api<void>('POST', '/yo/contrasena', { actual, nueva }),
};

export const authStaff = {
  ingresar: (identificador: string, contrasena: string) =>
    api<{ siguientePaso: PasoIngresoStaff }>('POST', '/auth/staff/ingreso', { identificador, contrasena }),
  estado: () => api<{ siguientePaso: PasoIngresoStaff }>('GET', '/auth/staff/estado'),
  contrasenaInicial: (nueva: string) => api<{ siguientePaso: PasoIngresoStaff }>('POST', '/auth/staff/contrasena-inicial', { nueva }),
  configurar2fa: () => api<{ secreto: string; uri: string }>('POST', '/auth/staff/2fa/configurar'),
  activar2fa: (codigo: string) => api<StaffYo>('POST', '/auth/staff/2fa/activar', { codigo }),
  verificar2fa: (codigo: string) => api<StaffYo>('POST', '/auth/staff/2fa/verificar', { codigo }),
  salir: () => api<void>('POST', '/auth/staff/salir'),
  yo: () => api<StaffYo>('GET', '/auth/staff/yo'),
  cambiarContrasena: (actual: string, nueva: string) => api<void>('POST', '/auth/staff/contrasena', { actual, nueva }),
};
