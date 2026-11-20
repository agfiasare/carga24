import type { EstadoPedido, MedioPago, ModoComision, MotivoRechazo, TipoPedido } from '@carga24/shared';
import { api, ErrorApi } from './cliente';

export interface PersonaBreve {
  id: string;
  nombre: string;
}

export interface Comprobante {
  id: string;
  tipo: 'pago' | 'retiro';
  mime: string;
  tamanoBytes: number;
  creadoEn: string;
}

export interface Pedido {
  id: number;
  tipo: TipoPedido;
  estado: EstadoPedido;
  canal: 'web' | 'manual';
  medioPago: MedioPago | null;
  monto: number;
  montoPagado: number | null;
  ganancia: number;
  comisionPb: number;
  modoComision: ModoComision;
  referenciaMovimiento: string | null;
  motivoRechazo: string | null;
  telefono: string | null;
  jugador: { id: string; nombreUsuario: string | null; telefono: string | null; usuarioPlataforma: string | null } | null;
  plataforma: { id: string; nombre: string };
  cuenta: { id: string; cbuCvu: string; alias: string | null; banco: string | null; titular: string | null; estado: 'pendiente' | 'verificada' | 'rechazada' } | null;
  tomadoPor: PersonaBreve | null;
  tomadoEn: string | null;
  verificadoPor: PersonaBreve | null;
  ejecutadoPor: PersonaBreve | null;
  comprobantes: Comprobante[];
  promo: { codigo: string; titulo: string; condiciones: string } | null;
  requiereAprobacion: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

export interface EventoPedido {
  id: string;
  de: EstadoPedido | null;
  a: EstadoPedido;
  nota: string | null;
  creadoEn: string;
  actor: { id: string; nombre: string; tipo: 'jugador' | 'staff' } | null;
}

export type PedidoDetalle = Pedido & { eventos: EventoPedido[] };

export interface ParametrosPedidos {
  comision: { modo: ModoComision; porcentajePb: number };
  montos: { cargaMinima: number; cargaMaxima: number; retiroMinimo: number; retiroConAprobacionDesde: number };
  plataformas: { id: string; nombre: string }[];
}

export interface NuevoPedido {
  tipo: TipoPedido;
  jugadorId?: string;
  telefono?: string;
  plataformaId: string;
  monto: number;
  medioPago: MedioPago;
  cuentaId?: string;
  nota?: string;
  codigoPromo?: string;
}

const accion = (id: number, nombre: string, cuerpo?: unknown) => api<PedidoDetalle>('POST', `/pedidos/${id}/${nombre}`, cuerpo);

export const pedidos = {
  parametros: () => api<ParametrosPedidos>('GET', '/pedidos/parametros'),
  cola: () => api<Pedido[]>('GET', '/pedidos/cola'),
  obtener: (id: number) => api<PedidoDetalle>('GET', `/pedidos/${id}`),
  crear: (datos: NuevoPedido) => api<PedidoDetalle>('POST', '/pedidos', datos),
  tomar: (id: number) => accion(id, 'tomar'),
  liberar: (id: number) => accion(id, 'liberar'),
  verificar: (id: number, referenciaMovimiento?: string) => accion(id, 'verificar', referenciaMovimiento ? { referenciaMovimiento } : {}),
  aprobar: (id: number) => accion(id, 'aprobar'),
  acreditar: (id: number) => accion(id, 'acreditar'),
  pagar: (id: number) => accion(id, 'pagar'),
  rechazar: (id: number, motivo: MotivoRechazo, detalle?: string) => accion(id, 'rechazar', { motivo, ...(detalle ? { detalle } : {}) }),
  /** Sube una foto o PDF (multipart). */
  async adjuntar(id: number, archivo: File, tipo: 'pago' | 'retiro' = 'pago'): Promise<Comprobante> {
    const formulario = new FormData();
    formulario.append('tipo', tipo);
    formulario.append('archivo', archivo);
    let respuesta: Response;
    try {
      respuesta = await fetch(`/api/v1/pedidos/${id}/comprobantes`, { method: 'POST', credentials: 'same-origin', body: formulario });
    } catch {
      throw new ErrorApi(0, 'No pudimos subir el archivo. Revisá tu conexión.');
    }
    const datos = (await respuesta.json().catch(() => ({}))) as { mensaje?: string } & Comprobante;
    if (!respuesta.ok) throw new ErrorApi(respuesta.status, datos.mensaje ?? 'No pudimos subir el archivo.');
    return datos;
  },
  urlComprobante: (id: string) => `/api/v1/comprobantes/${encodeURIComponent(id)}`,
};
