import { ArrowDownToLine, ArrowUpFromLine, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { PedidoJugador } from '../../../api/portal';
import { formatearFecha, formatearHora } from '../../../comun/formato';
import { InsigniaEstado, Monto, PlantillaJugador, type PlantillaJugadorProps } from '../../../componentes';
import { usePortalEnVivo } from '../../../sesion/portalEnVivo';
import clases from './portal.module.css';

export function PaginaJugador(props: Omit<PlantillaJugadorProps, 'noLeidas'> & { children: ReactNode }) {
  const { noLeidas } = usePortalEnVivo();
  return <PlantillaJugador {...props} noLeidas={noLeidas} />;
}

/** Un pedido en una lista: tipo, número, fecha, monto y estado. Lleva al detalle. */
export function FilaPedido({ pedido }: { pedido: PedidoJugador }) {
  const Icono = pedido.tipo === 'carga' ? ArrowDownToLine : ArrowUpFromLine;
  return (
    <Link to={`/pedidos/${pedido.id}`} className={clases.fila}>
      <span className={`${clases.icono} ${clases[pedido.tipo]}`}>
        <Icono size={18} aria-hidden="true" />
      </span>
      <span className={clases.filaTexto}>
        <strong>
          {pedido.tipo === 'carga' ? 'Carga' : 'Retiro'} #{pedido.id}
        </strong>
        <span className={clases.secundario}>
          {formatearFecha(pedido.creadoEn)} {formatearHora(pedido.creadoEn)}
        </span>
      </span>
      <span className={clases.filaDerecha}>
        <Monto centavos={pedido.monto} movimiento={pedido.tipo === 'carga' ? 'entrada' : 'salida'} tachado={pedido.estado === 'rechazado'} />
        <InsigniaEstado estado={pedido.estado} tipo={pedido.tipo} />
      </span>
      <ChevronRight size={18} aria-hidden="true" className={clases.flecha} />
    </Link>
  );
}

const PASOS = ['Enviado', 'En revisión', 'Confirmado', 'Listo'];

/** Progreso del pedido en 4 pasos, en palabras del jugador. */
export function PasosPedido({ pedido }: { pedido: Pick<PedidoJugador, 'estado' | 'tipo'> }) {
  if (pedido.estado === 'rechazado') return null;
  const actual = { pendiente: 0, en_proceso: 1, espera_aprobacion: 1, verificado: 2, acreditado: 3, pagado: 3 }[pedido.estado];
  return (
    <ol className={clases.pasos} aria-label="Avance del pedido">
      {PASOS.map((paso, i) => (
        <li key={paso} className={i <= actual ? clases.pasoHecho : clases.paso} aria-current={i === actual ? 'step' : undefined}>
          <span className={clases.punto} aria-hidden="true" />
          {i === 3 ? (pedido.tipo === 'carga' ? 'Acreditada' : 'Pagado') : paso}
        </li>
      ))}
    </ol>
  );
}

/** Explicación en una línea de dónde está el pedido. */
export function explicarEstado(p: Pick<PedidoJugador, 'estado' | 'tipo'>): string {
  switch (p.estado) {
    case 'pendiente':
      return 'Lo recibimos. En unos minutos alguien del equipo lo revisa.';
    case 'en_proceso':
      return p.tipo === 'carga' ? 'Estamos buscando tu transferencia en el banco.' : 'Estamos revisando tu retiro.';
    case 'espera_aprobacion':
      return 'Por el monto, un supervisor tiene que aprobarlo. Ya casi.';
    case 'verificado':
      return p.tipo === 'carga' ? 'Encontramos tu pago. Estamos cargando el saldo.' : 'Aprobado. Estamos haciendo la transferencia.';
    case 'acreditado':
      return 'Listo: el saldo ya está en tu usuario.';
    case 'pagado':
      return 'Listo: te transferimos el dinero.';
    case 'rechazado':
      return 'Este pedido fue rechazado.';
  }
}
