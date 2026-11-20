import { FileText, Upload } from 'lucide-react';
import { useState } from 'react';
import { textoEstado } from '../../../componentes/atomos/InsigniaEstado/InsigniaEstado';
import { pedidos } from '../../../api/pedidos';
import { useAccion } from '../../../api/useAccion';
import { useConsulta } from '../../../api/useConsulta';
import { formatearFecha, formatearHora } from '../../../comun/formato';
import { Aviso, InsigniaEstado, Modal } from '../../../componentes';
import { usePermisos } from '../PaginaPanel';
import { ResumenPedido } from './comun';
import clases from './cola.module.css';

/** Detalle: datos, comprobantes (se abren en grande) e historial de cada cambio. */
export function DetallePedido({ id, alCerrar }: { id: number; alCerrar: () => void }) {
  const { algunoDe } = usePermisos();
  const { datos: pedido, error, recargar } = useConsulta(() => pedidos.obtener(id), [id]);
  const [ampliado, setAmpliado] = useState<string | null>(null);
  const subida = useAccion((archivo: File) => pedidos.adjuntar(id, archivo));
  const cerrado = pedido ? ['acreditado', 'pagado', 'rechazado'].includes(pedido.estado) : true;
  const puedeAdjuntar = !cerrado && algunoDe('pedidos.crear', 'pedidos.verificar', 'pedidos.pagar');

  async function adjuntar(archivo: File | undefined) {
    if (!archivo) return;
    if (await subida.ejecutar(archivo)) recargar();
  }

  return (
    <Modal titulo={pedido ? `${pedido.tipo === 'carga' ? 'Carga' : 'Retiro'} #${pedido.id}` : `Pedido #${id}`} alCerrar={alCerrar}>
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      {pedido ? (
        <>
          <div className={clases.filaEstado}>
            <InsigniaEstado estado={pedido.estado} tipo={pedido.tipo} />
            <span className={clases.secundario}>
              {pedido.canal === 'manual' ? 'Registrado desde WhatsApp' : 'Pedido desde la web'} · {formatearFecha(pedido.creadoEn)} {formatearHora(pedido.creadoEn)}
            </span>
          </div>
          {pedido.motivoRechazo ? <Aviso tipo="error">{pedido.motivoRechazo}</Aviso> : null}
          <ResumenPedido pedido={pedido} />
          {pedido.referenciaMovimiento ? (
            <p className={clases.secundario}>
              Número de operación: <strong>{pedido.referenciaMovimiento}</strong>
            </p>
          ) : null}

          <section aria-labelledby="titulo-comprobantes" className={clases.seccion}>
            <h3 id="titulo-comprobantes">Comprobantes</h3>
            {subida.error ? <Aviso tipo="error">{subida.error.message}</Aviso> : null}
            {pedido.comprobantes.length === 0 ? <p className={clases.secundario}>Sin comprobantes.</p> : null}
            <div className={clases.comprobantes}>
              {pedido.comprobantes.map((c) =>
                c.mime.startsWith('image/') ? (
                  <button key={c.id} type="button" className={clases.miniatura} onClick={() => setAmpliado(pedidos.urlComprobante(c.id))} aria-label={`Ampliar comprobante ${c.tipo === 'retiro' ? 'de la transferencia' : 'de pago'}`}>
                    <img src={pedidos.urlComprobante(c.id)} alt="" />
                  </button>
                ) : (
                  <a key={c.id} className={clases.pdf} href={pedidos.urlComprobante(c.id)} target="_blank" rel="noreferrer">
                    <FileText size={20} aria-hidden="true" /> PDF {c.tipo === 'retiro' ? 'de la transferencia' : 'de pago'}
                  </a>
                ),
              )}
              {puedeAdjuntar ? (
                <label className={clases.adjuntar} aria-busy={subida.cargando}>
                  <Upload size={18} aria-hidden="true" />
                  {subida.cargando ? 'Subiendo…' : 'Adjuntar'}
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => void adjuntar(e.target.files?.[0])} disabled={subida.cargando} />
                </label>
              ) : null}
            </div>
          </section>

          <section aria-labelledby="titulo-historial" className={clases.seccion}>
            <h3 id="titulo-historial">Historial</h3>
            <ol className={clases.historial}>
              {pedido.eventos.map((e) => (
                <li key={e.id}>
                  <span className={clases.hora}>{formatearHora(e.creadoEn)}</span>
                  <span>
                    <strong>{textoEstado(e.a, pedido.tipo)}</strong>
                    {e.actor ? ` · ${e.actor.nombre}` : ''}
                    {e.nota ? <span className={clases.secundario}> — {e.nota}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </>
      ) : null}
      {ampliado ? (
        <Modal titulo="Comprobante" alCerrar={() => setAmpliado(null)}>
          <img src={ampliado} alt="Comprobante ampliado" className={clases.ampliado} />
          <a href={ampliado} target="_blank" rel="noreferrer">
            Abrir en otra pestaña
          </a>
        </Modal>
      ) : null}
    </Modal>
  );
}
