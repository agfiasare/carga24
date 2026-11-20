import type { EstadoPedido, ModoComision, TipoPedido } from '@carga24/shared';
import { api, ErrorApi } from './cliente';

export interface CuentaPropia {
  id: string;
  cbuCvu: string;
  alias: string | null;
  banco: string | null;
  titular: string | null;
  estado: 'pendiente' | 'verificada' | 'rechazada';
  creadoEn: string;
}

export interface PedidoJugador {
  id: number;
  tipo: TipoPedido;
  estado: EstadoPedido;
  canal: 'web' | 'manual';
  monto: number;
  montoPagado: number | null;
  comision: number;
  comisionPb: number;
  modoComision: ModoComision;
  motivoRechazo: string | null;
  cuenta: { id: string; cbuCvu: string; alias: string | null; estado: CuentaPropia['estado'] } | null;
  plataforma: { id: string; nombre: string };
  comprobantes: { id: string; tipo: 'pago' | 'retiro'; mime: string; tamanoBytes: number; creadoEn: string }[];
  creadoEn: string;
  actualizadoEn: string;
}

export type PedidoJugadorDetalle = PedidoJugador & { historial: { a: EstadoPedido; creadoEn: string }[] };

export interface ParametrosPortal {
  comision: { modo: ModoComision; porcentajePb: number };
  montos: { cargaMinima: number; cargaMaxima: number; retiroMinimo: number; retiroConAprobacionDesde: number };
  cuentasPendientesMaximas: number;
  datosPago: { alias: string; titular: string; banco: string };
  horario: string;
  plataforma: { id: string; nombre: string } | null;
}

export interface Avisos {
  noLeidas: number;
  avisos: { id: string; titulo: string; texto: string | null; pedidoId: number | null; leidaEn: string | null; creadoEn: string }[];
}

export interface Novedad {
  id: string;
  titulo: string;
  texto: string;
  fijada: boolean;
  publicadaEn: string | null;
}

/** Envía un formulario (multipart), para pedidos y comprobantes con archivo. */
async function enviarFormulario<T>(ruta: string, formulario: FormData): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`/api/v1${ruta}`, { method: 'POST', credentials: 'same-origin', body: formulario });
  } catch {
    throw new ErrorApi(0, 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.');
  }
  const datos = (await respuesta.json().catch(() => ({}))) as { mensaje?: string; errores?: { campo: string; mensaje: string }[] };
  if (!respuesta.ok) throw new ErrorApi(respuesta.status, datos.mensaje ?? 'Algo salió mal. Probá de nuevo.', undefined, datos.errores);
  return datos as T;
}

export const portal = {
  parametros: () => api<ParametrosPortal>('GET', '/yo/parametros'),
  cuentas: () => api<CuentaPropia[]>('GET', '/yo/cuentas'),
  agregarCuenta: (datos: { cbuCvu: string; alias?: string; banco?: string; titular?: string }) => api<CuentaPropia>('POST', '/yo/cuentas', datos),
  quitarCuenta: (id: string) => api<void>('DELETE', `/yo/cuentas/${encodeURIComponent(id)}`),
  pedidos: (filtro: { estado?: string; tipo?: string; pagina?: number } = {}) => {
    const q = new URLSearchParams(Object.entries(filtro).flatMap(([k, v]) => (v ? [[k, String(v)]] : [])));
    return api<{ total: number; pagina: number; porPagina: number; pedidos: PedidoJugador[] }>('GET', `/yo/pedidos?${q.toString()}`);
  },
  pedido: (id: number) => api<PedidoJugadorDetalle>('GET', `/yo/pedidos/${id}`),
  pedir: (datos: { tipo: TipoPedido; monto: number; cuentaId: string; archivo?: File }) => {
    const f = new FormData();
    f.append('tipo', datos.tipo);
    f.append('monto', String(datos.monto));
    f.append('cuentaId', datos.cuentaId);
    if (datos.archivo) f.append('archivo', datos.archivo);
    return enviarFormulario<PedidoJugadorDetalle>('/yo/pedidos', f);
  },
  adjuntar: (id: number, archivo: File) => {
    const f = new FormData();
    f.append('archivo', archivo);
    return enviarFormulario<unknown>(`/yo/pedidos/${id}/comprobantes`, f);
  },
  urlComprobante: (id: string) => `/api/v1/yo/comprobantes/${encodeURIComponent(id)}`,
  avisos: () => api<Avisos>('GET', '/yo/notificaciones'),
  marcarLeidas: () => api<Avisos>('POST', '/yo/notificaciones/leidas', {}),
  novedades: () => api<Novedad[]>('GET', '/yo/novedades'),
};

export const ESTADOS_ABIERTOS: EstadoPedido[] = ['pendiente', 'en_proceso', 'espera_aprobacion', 'verificado'];
