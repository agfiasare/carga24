import { formatearPesos } from '@carga24/shared';
import { FileText } from 'lucide-react';
import { useParams } from 'react-router';
import { ESTADOS_ABIERTOS, portal } from '../../../api/portal';
import { useAccion } from '../../../api/useAccion';
import { useConsulta } from '../../../api/useConsulta';
import { formatearFecha, formatearHora } from '../../../comun/formato';
import { Aviso, InsigniaEstado, Monto } from '../../../componentes';
import { textoEstado } from '../../../componentes/atomos/InsigniaEstado/InsigniaEstado';
import { usePortalEnVivo } from '../../../sesion/portalEnVivo';
import { explicarEstado, PaginaJugador, PasosPedido } from './comun';
import clases from './portal.module.css';

export function PedidoDetalle() {
  const id = Number(useParams().id);
  const { version } = usePortalEnVivo();
  const { datos: pedido, error, recargar } = useConsulta(() => portal.pedido(id), [id, version]);
  const subida = useAccion((archivo: File) => portal.adjuntar(id, archivo));

  async function adjuntar(archivo: File | undefined) {
    if (archivo && (await subida.ejecutar(archivo))) recargar();
  }

  const titulo = pedido ? `${pedido.tipo === 'carga' ? 'Carga' : 'Retiro'} #${pedido.id}` : 'Pedido';
  return (
    <PaginaJugador titulo={titulo} volver={{ a: '/historial', texto: 'Tus pedidos' }}>
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      {pedido ? (
        <>
          <section className={`${clases.tarjeta} ${ESTADOS_ABIERTOS.includes(pedido.estado) ? clases.destacada : ''}`} aria-label="Estado">
            <InsigniaEstado estado={pedido.estado} tipo={pedido.tipo} />
            <Monto centavos={pedido.monto} tamano="lg" tachado={pedido.estado === 'rechazado'} />
            <PasosPedido pedido={pedido} />
            <span>{explicarEstado(pedido)}</span>
            {pedido.motivoRechazo ? <Aviso tipo="error">{pedido.motivoRechazo}</Aviso> : null}
          </section>

          <section className={clases.tarjeta} aria-labelledby="titulo-detalle">
            <h2 id="titulo-detalle">Detalle</h2>
            <dl className={clases.datos}>
              {pedido.tipo === 'carga' && pedido.montoPagado !== null ? (
                <>
                  <dt>Transferiste</dt>
                  <dd>{formatearPesos(pedido.montoPagado)}</dd>
                  <dt>Comisión</dt>
                  <dd>{formatearPesos(pedido.comision)}</dd>
                  <dt>Se acredita</dt>
                  <dd>{formatearPesos(pedido.monto)}</dd>
                </>
              ) : (
                <>
                  <dt>Te transferimos</dt>
                  <dd>{formatearPesos(pedido.monto)}</dd>
                </>
              )}
              {pedido.cuenta ? (
                <>
                  <dt>{pedido.tipo === 'carga' ? 'Desde' : 'A'}</dt>
                  <dd>{pedido.cuenta.alias ?? `CBU …${pedido.cuenta.cbuCvu.slice(-6)}`}</dd>
                </>
              ) : null}
              <dt>Fecha</dt>
              <dd>
                {formatearFecha(pedido.creadoEn)} {formatearHora(pedido.creadoEn)}
              </dd>
            </dl>
          </section>

          <section className={clases.tarjeta} aria-labelledby="titulo-comprobantes">
            <h2 id="titulo-comprobantes">Comprobantes</h2>
            {subida.error ? <Aviso tipo="error">{subida.error.message}</Aviso> : null}
            {pedido.comprobantes.length === 0 ? <span className={clases.secundario}>Sin comprobantes.</span> : null}
            {pedido.comprobantes.map((c) => (
              <a key={c.id} href={portal.urlComprobante(c.id)} target="_blank" rel="noreferrer" className={clases.enlaces}>
                <FileText size={16} aria-hidden="true" /> {c.tipo === 'retiro' ? 'Transferencia que te hicimos' : 'Tu comprobante de pago'} ({formatearHora(c.creadoEn)})
              </a>
            ))}
            {ESTADOS_ABIERTOS.includes(pedido.estado) ? (
              <label className={clases.archivo}>
                <span>{subida.cargando ? 'Subiendo…' : 'Agregar otro comprobante'}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={subida.cargando} onChange={(e) => void adjuntar(e.target.files?.[0])} />
              </label>
            ) : null}
          </section>

          <section className={clases.tarjeta} aria-labelledby="titulo-historial">
            <h2 id="titulo-historial">Historial</h2>
            <ol className={clases.lista} style={{ margin: 0, paddingLeft: 18 }}>
              {pedido.historial.map((h, i) => (
                <li key={i}>
                  <strong>{textoEstado(h.a, pedido.tipo)}</strong> <span className={clases.secundario}>{formatearFecha(h.creadoEn)} {formatearHora(h.creadoEn)}</span>
                </li>
              ))}
            </ol>
          </section>
        </>
      ) : null}
    </PaginaJugador>
  );
}
