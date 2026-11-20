import type { EstadoPedido, ModoComision, TipoPedido } from '@carga24/shared';
import { api } from './cliente';

export interface Configuracion {
  comision: { modo: ModoComision; porcentajePb: number };
  montos: { cargaMinima: number; cargaMaxima: number; retiroMinimo: number; retiroConAprobacionDesde: number };
  cuentasPendientesMaximas: number;
  pago: { alias: string; titular: string; banco: string };
  horario: string;
  whatsapp: string;
  actualizadoEn: string | null;
}

export interface Plataforma {
  id: string;
  nombre: string;
  activa: boolean;
  _count: { pedidos: number };
}

export interface Resumen {
  desde: string;
  hasta: string;
  totales: {
    pedidos: number;
    cargas: { cantidad: number; acreditado: number; transferido: number };
    retiros: { cantidad: number; pagado: number };
    ganancia: number;
    rechazados: number;
    enCurso: number;
  };
  porCanal: { canal: 'web' | 'manual'; cargas: number; retiros: number; ganancia: number; pedidos: number }[];
  porOperador: { id: string | null; nombre: string; pedidos: number; acreditado: number; pagado: number; ganancia: number }[];
  porJugador: { jugador: string; pedidos: number; cargado: number; retirado: number }[];
  porDia: { fecha: string; cargas: number; retiros: number; ganancia: number }[];
}

export interface FiltrosPedidos {
  desde: string;
  hasta: string;
  estado?: EstadoPedido | '';
  tipo?: TipoPedido | '';
  canal?: 'web' | 'manual' | '';
  buscar?: string;
  pagina?: number;
}

export interface FilaReporte {
  id: number;
  tipo: TipoPedido;
  estado: EstadoPedido;
  canal: 'web' | 'manual';
  monto: number;
  montoPagado: number | null;
  ganancia: number;
  creadoEn: string;
  jugador: string | null;
  operador: string | null;
  referenciaMovimiento: string | null;
}

export interface RegistroAuditoria {
  id: string;
  accion: string;
  entidad: string;
  entidadId: string | null;
  datos: unknown;
  ip: string | null;
  creadoEn: string;
  actor: { id: string; nombre: string; tipo: 'jugador' | 'staff' } | null;
}

export const consulta = (filtros: object) =>
  new URLSearchParams(Object.entries(filtros).flatMap(([k, v]) => (v === undefined || v === '' ? [] : [[k, String(v)]]))).toString();

export const administracion = {
  configuracion: () => api<Configuracion>('GET', '/configuracion'),
  guardarConfiguracion: (cambios: Partial<Omit<Configuracion, 'actualizadoEn'>>) => api<Configuracion>('PUT', '/configuracion', cambios),
  plataformas: () => api<Plataforma[]>('GET', '/plataformas'),
  crearPlataforma: (nombre: string) => api<Plataforma>('POST', '/plataformas', { nombre }),
  editarPlataforma: (id: string, datos: { nombre?: string; activa?: boolean }) => api<Plataforma>('PATCH', `/plataformas/${encodeURIComponent(id)}`, datos),
  resumen: (desde: string, hasta: string) => api<Resumen>('GET', `/reportes/resumen?${consulta({ desde, hasta })}`),
  pedidos: (filtros: FiltrosPedidos) => api<{ total: number; pagina: number; porPagina: number; pedidos: FilaReporte[] }>('GET', `/reportes/pedidos?${consulta(filtros)}`),
  urlExcel: (filtros: FiltrosPedidos) => `/api/v1/reportes/pedidos.xlsx?${consulta({ ...filtros, pagina: undefined })}`,
  auditoria: (filtros: { actorId?: string; accion?: string; desde?: string; hasta?: string; pagina?: number }) =>
    api<{ total: number; pagina: number; porPagina: number; registros: RegistroAuditoria[] }>('GET', `/auditoria?${consulta(filtros)}`),
  opcionesAuditoria: () => api<{ acciones: string[]; personas: { id: string; nombre: string }[] }>('GET', '/auditoria/opciones'),
};

/** Fecha de hoy en Argentina, desplazada `dias` días (AAAA-MM-DD). */
export function fechaRelativa(dias = 0, desde = new Date()): string {
  const momento = new Date(desde.getTime() + dias * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(momento);
}
