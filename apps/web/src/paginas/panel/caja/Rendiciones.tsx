import { formatearPesos } from '@carga24/shared';
import { useState } from 'react';
import { caja } from '../../../api/caja';
import { useAccion } from '../../../api/useAccion';
import { useConsulta } from '../../../api/useConsulta';
import { formatearConSigno, formatearFecha, formatearHora, leerPesos } from '../../../comun/formato';
import { Aviso, Boton, CampoFormulario, ModalConfirmacion } from '../../../componentes';
import { PaginaPanel, usePermisos } from '../PaginaPanel';
import panel from '../panel.module.css';
import reportes from '../reportes.module.css';
import clases from './caja.module.css';

const momento = (iso: string) => `${formatearFecha(iso)} ${formatearHora(iso)}`;

/** Lo que se le rinde a la plataforma: cargas netas − premios, con lo que quedó de la vez anterior. */
export function Rendiciones() {
  const { tiene } = usePermisos();
  const { datos, setDatos, error } = useConsulta(caja.rendiciones, []);
  const [montoTexto, setMontoTexto] = useState('');
  const [nota, setNota] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [listo, setListo] = useState(false);
  const rendicion = useAccion(caja.rendir);
  const p = datos?.pendiente;
  // Por defecto se propone rendir exactamente lo que corresponde.
  const monto = montoTexto.trim() ? leerPesos(montoTexto.replace(/^-/, '')) : (p?.correspondia ?? null);
  const montoFinal = montoTexto.trim().startsWith('-') && monto !== null ? -monto : monto;

  async function rendir() {
    if (montoFinal === null) return;
    const r = await rendicion.ejecutar({ monto: montoFinal, ...(nota.trim() ? { nota: nota.trim() } : {}) });
    if (r) {
      setDatos(r.valor);
      setConfirmando(false);
      setMontoTexto('');
      setNota('');
      setListo(true);
    }
  }

  return (
    <PaginaPanel titulo="Rendiciones" requiere={['caja.ver', 'rendiciones.registrar']}>
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      {listo ? <Aviso tipo="ok">Rendición registrada.</Aviso> : null}
      {p && datos ? (
        <>
          <div className={panel.columnas}>
            <section className={panel.tarjeta} aria-labelledby="titulo-pendiente">
              <h2 id="titulo-pendiente">A rendir desde la última rendición</h2>
              <p className={panel.explicacion}>
                {p.desde ? `Desde el ${momento(p.desde)}` : 'Desde el inicio'} · {p.cantidadPedidos} {p.cantidadPedidos === 1 ? 'pedido' : 'pedidos'}
              </p>
              <dl className={clases.balance}>
                <dt>Cargas netas (fichas acreditadas)</dt>
                <dd>{formatearPesos(p.cargasNetas)}</dd>
                <dt>Premios pagados</dt>
                <dd className={p.premios > 0 ? clases.negativo : undefined}>{formatearConSigno(-p.premios)}</dd>
                {p.arrastre !== 0 ? (
                  <>
                    <dt>Diferencia de la rendición anterior</dt>
                    <dd>{formatearConSigno(p.arrastre)}</dd>
                  </>
                ) : null}
                <dt className={clases.total}>A rendir</dt>
                <dd className={clases.total}>{formatearPesos(p.correspondia)}</dd>
              </dl>
              <Aviso tipo="ok">La comisión del período ({formatearPesos(p.comision)}) no se rinde: es la ganancia de la agencia.</Aviso>
            </section>

            {tiene('rendiciones.registrar') ? (
              <section className={panel.tarjeta} aria-labelledby="titulo-registrar">
                <h2 id="titulo-registrar">Registrar rendición</h2>
                <CampoFormulario
                  etiqueta="Monto rendido"
                  ayuda="Si rendís más o menos, la diferencia pasa a la rendición siguiente."
                  inputMode="decimal"
                  placeholder={formatearPesos(p.correspondia)}
                  value={montoTexto}
                  onChange={(e) => setMontoTexto(e.target.value)}
                  error={montoTexto.trim() && monto === null ? 'Escribí un monto válido' : rendicion.error?.delCampo('monto')}
                />
                <CampoFormulario etiqueta="Nota (opcional)" placeholder="Ej.: transferencia, operación 12345" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} />
                <Boton onClick={() => setConfirmando(true)} disabled={montoFinal === null}>
                  Registrar rendición
                </Boton>
              </section>
            ) : null}
          </div>

          <section className={panel.tarjeta} aria-labelledby="titulo-historial">
            <h2 id="titulo-historial">Historial</h2>
            {datos.historial.length === 0 ? (
              <p className={panel.vacio}>Todavía no hay rendiciones.</p>
            ) : (
              <div className={panel.envoltorioTabla}>
                <table className={panel.tabla}>
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col" className={reportes.numero}>Correspondía</th>
                      <th scope="col" className={reportes.numero}>Rendido</th>
                      <th scope="col" className={reportes.numero}>Diferencia</th>
                      <th scope="col">Nota</th>
                      <th scope="col">Quién</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.historial.map((r) => {
                      const diferencia = r.correspondia - r.rendido;
                      return (
                        <tr key={r.id}>
                          <td>{momento(r.creadoEn)}</td>
                          <td className={reportes.numero}>{formatearPesos(r.correspondia)}</td>
                          <td className={reportes.numero}>
                            <strong>{formatearPesos(r.rendido)}</strong>
                          </td>
                          <td className={reportes.numero}>{diferencia === 0 ? '—' : `${formatearConSigno(diferencia)} a la siguiente`}</td>
                          <td>{r.nota ?? '—'}</td>
                          <td>{r.creadoPor ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}

      {confirmando && p && montoFinal !== null ? (
        <ModalConfirmacion titulo="Registrar rendición" textoConfirmar="Registrar" cargando={rendicion.cargando} alCerrar={() => setConfirmando(false)} alConfirmar={() => void rendir()}>
          <dl className={clases.recuadro}>
            <dt>Correspondía</dt>
            <dd>{formatearPesos(p.correspondia)}</dd>
            <dt>Rendís</dt>
            <dd>{formatearPesos(montoFinal)}</dd>
            {p.correspondia !== montoFinal ? (
              <>
                <dt>Pasa a la siguiente</dt>
                <dd>{formatearConSigno(p.correspondia - montoFinal)}</dd>
              </>
            ) : null}
          </dl>
          {rendicion.error ? <Aviso tipo="error">{rendicion.error.message}</Aviso> : null}
        </ModalConfirmacion>
      ) : null}
    </PaginaPanel>
  );
}
