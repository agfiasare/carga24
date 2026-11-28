import { formatearPesos } from '@carga24/shared';
import type { Pedido } from '../../../api/pedidos';
import { formatearTelefono } from '../../../comun/formato';
import clases from './cola.module.css';

export function nombreJugador(p: Pick<Pedido, 'jugador' | 'telefono'>): string {
  return p.jugador?.nombreUsuario ?? formatearTelefono(p.jugador?.telefono ?? p.telefono);
}

export function textoCuenta(cuenta: Pedido['cuenta']): string {
  if (!cuenta) return '—';
  const estado = cuenta.estado === 'verificada' ? '' : ` (${cuenta.estado})`;
  return `${cuenta.alias ?? ''}${cuenta.alias ? ' · ' : ''}CBU/CVU ${cuenta.cbuCvu}${estado}`;
}

const MEDIOS = { cuenta_registrada: 'Cuenta registrada', otra_cuenta: 'Otra cuenta', efectivo: 'Efectivo' } as const;

/** Lo esencial de un pedido, para los modales: quién, cuánto y desde/hacia dónde. */
export function ResumenPedido({ pedido }: { pedido: Pedido }) {
  const carga = pedido.tipo === 'carga';
  return (
    <dl className={clases.resumen}>
      <dt>Pedido</dt>
      <dd>
        {carga ? 'Carga' : 'Retiro'} #{pedido.id}
      </dd>
      <dt>Jugador</dt>
      <dd>
        {nombreJugador(pedido)}
        {pedido.jugador?.usuarioPlataforma ? <span className={clases.secundario}> · en plataforma: {pedido.jugador.usuarioPlataforma}</span> : null}
      </dd>
      {carga && pedido.montoPagado !== null ? (
        <>
          <dt>Tiene que transferir</dt>
          <dd className={clases.importe}>{formatearPesos(pedido.montoPagado)}</dd>
        </>
      ) : null}
      {!carga && pedido.montoPagado !== null ? (
        <>
          <dt>Pide (fichas)</dt>
          <dd>{formatearPesos(pedido.montoPagado)}</dd>
          <dt>Comisión de retiro</dt>
          <dd>{formatearPesos(pedido.ganancia)}</dd>
        </>
      ) : null}
      <dt>{carga ? 'Se acredita' : 'Se transfiere'}</dt>
      <dd className={clases.importe}>{formatearPesos(pedido.monto)}</dd>
      <dt>Medio</dt>
      <dd>{pedido.medioPago ? MEDIOS[pedido.medioPago] : '—'}</dd>
      {pedido.cuenta ? (
        <>
          <dt>{carga ? 'Desde' : 'Hacia'}</dt>
          <dd>{textoCuenta(pedido.cuenta)}</dd>
        </>
      ) : null}
      <dt>Plataforma</dt>
      <dd>{pedido.plataforma.nombre}</dd>
      {pedido.promo ? (
        <>
          <dt>Promo</dt>
          <dd>
            {pedido.promo.codigo} · {pedido.promo.titulo}
            <span className={clases.secundario}> — {pedido.promo.condiciones}</span>
          </dd>
        </>
      ) : null}
    </dl>
  );
}
