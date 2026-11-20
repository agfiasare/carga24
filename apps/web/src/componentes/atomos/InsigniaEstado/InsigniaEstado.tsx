import type { EstadoPedido, TipoPedido } from '@carga24/shared';
import clases from './InsigniaEstado.module.css';

type Tono = 'proceso' | 'ok' | 'error' | 'neutro';

const ETIQUETAS: Record<EstadoPedido, { texto: string; tono: Tono }> = {
  pendiente: { texto: 'Pendiente', tono: 'neutro' },
  en_proceso: { texto: 'En proceso', tono: 'proceso' },
  espera_aprobacion: { texto: 'Espera aprobación', tono: 'proceso' },
  verificado: { texto: 'Verificado', tono: 'proceso' },
  acreditado: { texto: 'Acreditada', tono: 'ok' },
  pagado: { texto: 'Pagado', tono: 'ok' },
  rechazado: { texto: 'Rechazado', tono: 'error' },
};

export interface InsigniaEstadoProps {
  estado: EstadoPedido;
  /** Para ajustar el género del texto: "Verificada" (carga) / "Verificado" (retiro). */
  tipo?: TipoPedido;
}

export function textoEstado(estado: EstadoPedido, tipo?: TipoPedido): string {
  if (estado === 'verificado' && tipo === 'carga') return 'Verificada';
  if (estado === 'rechazado' && tipo === 'carga') return 'Rechazada';
  return ETIQUETAS[estado].texto;
}

/** Insignia con el estado de un pedido. Colores fijos: verde = listo, ámbar = en curso, rojo = rechazado. */
export function InsigniaEstado({ estado, tipo }: InsigniaEstadoProps) {
  const { tono } = ETIQUETAS[estado];
  return <span className={`${clases.insignia} ${clases[tono]}`}>{textoEstado(estado, tipo)}</span>;
}
