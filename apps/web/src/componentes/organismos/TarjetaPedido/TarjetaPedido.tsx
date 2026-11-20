import type { EstadoPedido, MedioPago, TipoPedido } from '@carga24/shared';
import { ArrowDownToLine, ArrowUpFromLine, Paperclip, UserCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Etiqueta } from '../../atomos/Etiqueta/Etiqueta';
import { InsigniaEstado } from '../../atomos/InsigniaEstado/InsigniaEstado';
import { Monto } from '../../atomos/Monto/Monto';
import clases from './TarjetaPedido.module.css';

export interface DatosTarjetaPedido {
  id: number;
  tipo: TipoPedido;
  estado: EstadoPedido;
  canal: 'web' | 'manual';
  medioPago: MedioPago | null;
  monto: number;
  montoPagado: number | null;
  jugador: string;
  /** "hace 5 min", "14:32"… */
  cuando: string;
  tomadoPor?: string | null;
  comprobantes: number;
  requiereAprobacion?: boolean;
  motivoRechazo?: string | null;
}

export interface TarjetaPedidoProps {
  pedido: DatosTarjetaPedido;
  /** Botones de las acciones disponibles. */
  acciones?: ReactNode;
  /** Abre el detalle del pedido. */
  alAbrir?: () => void;
  /** Resalta un pedido que acaba de entrar. */
  nuevo?: boolean;
}

const MEDIOS: Record<MedioPago, string> = { cuenta_registrada: 'Cuenta registrada', otra_cuenta: 'Otra cuenta', efectivo: 'Efectivo' };

/** Un pedido en la cola: qué es, de quién, cuánto, en qué estado y qué se puede hacer. */
export function TarjetaPedido({ pedido, acciones, alAbrir, nuevo = false }: TarjetaPedidoProps) {
  const Icono = pedido.tipo === 'carga' ? ArrowDownToLine : ArrowUpFromLine;
  return (
    <article className={`${clases.tarjeta} ${clases[pedido.tipo]} ${nuevo ? clases.nuevo : ''}`} aria-labelledby={`pedido-${pedido.id}`}>
      <header className={clases.cabecera}>
        <span className={clases.tipo}>
          <Icono size={16} aria-hidden="true" />
          <button type="button" id={`pedido-${pedido.id}`} className={clases.numero} onClick={alAbrir} disabled={!alAbrir}>
            {pedido.tipo === 'carga' ? 'Carga' : 'Retiro'} #{pedido.id}
          </button>
        </span>
        <span className={clases.cuando}>{pedido.cuando}</span>
      </header>
      <div className={clases.cuerpo}>
        <div>
          <div className={clases.jugador}>{pedido.jugador}</div>
          <div className={clases.detalle}>
            {pedido.canal === 'manual' ? 'WhatsApp' : 'Web'}
            {pedido.medioPago ? ` · ${MEDIOS[pedido.medioPago]}` : ''}
          </div>
        </div>
        <div className={clases.importes}>
          <Monto centavos={pedido.monto} tamano="md" />
          {pedido.tipo === 'carga' && pedido.montoPagado !== null && pedido.montoPagado !== pedido.monto ? (
            <span className={clases.detalle}>
              transfiere <Monto centavos={pedido.montoPagado} tamano="sm" />
            </span>
          ) : null}
        </div>
      </div>
      <div className={clases.etiquetas}>
        <InsigniaEstado estado={pedido.estado} tipo={pedido.tipo} />
        {pedido.requiereAprobacion && (pedido.estado === 'pendiente' || pedido.estado === 'en_proceso') ? <Etiqueta tono="aviso">Requiere aprobación</Etiqueta> : null}
        {pedido.tomadoPor && pedido.estado === 'en_proceso' ? (
          <Etiqueta>
            <UserCheck size={12} aria-hidden="true" /> {pedido.tomadoPor}
          </Etiqueta>
        ) : null}
        {pedido.comprobantes > 0 ? (
          <Etiqueta>
            <Paperclip size={12} aria-hidden="true" /> {pedido.comprobantes}
            <span className={clases.oculto}> comprobante{pedido.comprobantes > 1 ? 's' : ''}</span>
          </Etiqueta>
        ) : null}
      </div>
      {pedido.motivoRechazo ? <p className={clases.motivo}>{pedido.motivoRechazo}</p> : null}
      {acciones ? <div className={clases.acciones}>{acciones}</div> : null}
    </article>
  );
}
