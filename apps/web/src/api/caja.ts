import type { PersonaBreve } from './pedidos';
import { api } from './cliente';

export interface Turno {
  id: string;
  usuario: PersonaBreve;
  abiertoEn: string;
  cerradoEn: string | null;
  cerradoPor: PersonaBreve | null;
  cajaAlAbrir: number;
  cajaAlCerrar: number | null;
  saldoInformado: number | null;
  nota: string | null;
  cantidadCargas: number;
  cantidadRetiros: number;
  /** Lo que transfirieron los jugadores. */
  ingresos: number;
  /** Parte de los ingresos que es ganancia. */
  comision: number;
  /** Fichas acreditadas. */
  cargasNetas: number;
  premios: number;
  /** ingresos − premios. */
  resultado: number;
}

export interface TurnoActual {
  turno: Turno | null;
  /** Saldo de la caja sin liquidar. */
  caja: number;
  ultimoCierre: { usuario: string | null; cerradoEn: string } | null;
}

export interface ResumenTurno extends Turno {
  /** Caja antes de sumar este turno. */
  cajaAntes: number;
  /** Pedidos que la persona tiene tomados: se liberan al cerrar. */
  tomados: { id: number; tipo: 'carga' | 'retiro'; monto: number }[];
  pedidosAbiertos: number;
}

export interface MovimientoCaja {
  id: string;
  tipo: 'cierre_turno' | 'liquidacion' | 'ajuste';
  monto: number;
  saldoPosterior: number;
  nota: string | null;
  creadoEn: string;
  creadoPor: string | null;
  turno: { id: string; usuario: string | null; abiertoEn: string; cerradoEn: string | null } | null;
}

export interface EstadoCaja {
  saldo: number;
  ultimaLiquidacion: string | null;
  gananciaSemana: number;
  turnosAbiertos: Turno[];
  turnosSinLiquidar: Turno[];
  movimientos: MovimientoCaja[];
}

export interface Rendicion {
  id: string;
  desde: string;
  hasta: string;
  cargasNetas: number;
  premios: number;
  arrastre: number;
  correspondia: number;
  rendido: number;
  nota: string | null;
  creadoEn: string;
  creadoPor: string | null;
}

export interface EstadoRendiciones {
  pendiente: { desde: string | null; hasta: string; cargasNetas: number; premios: number; comision: number; cantidadPedidos: number; arrastre: number; correspondia: number };
  historial: Rendicion[];
}

export const caja = {
  turnoActual: () => api<TurnoActual>('GET', '/turnos/actual'),
  abrirTurno: () => api<TurnoActual>('POST', '/turnos'),
  turno: (id: string) => api<ResumenTurno>('GET', `/turnos/${id}`),
  cerrarTurno: (id: string, datos: { saldoInformado?: number; nota?: string }) => api<ResumenTurno>('POST', `/turnos/${id}/cierre`, datos),
  estado: () => api<EstadoCaja>('GET', '/caja'),
  liquidar: (datos: { monto: number; nota?: string }) => api<EstadoCaja>('POST', '/caja/liquidaciones', datos),
  ajustar: (datos: { monto: number; nota: string }) => api<EstadoCaja>('POST', '/caja/ajustes', datos),
  rendiciones: () => api<EstadoRendiciones>('GET', '/rendiciones'),
  rendir: (datos: { monto: number; nota?: string }) => api<EstadoRendiciones>('POST', '/rendiciones', datos),
};
