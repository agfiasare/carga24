import { formatearPesos } from '@carga24/shared';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { caja, type ResumenTurno } from '../../../api/caja';
import { useAccion } from '../../../api/useAccion';
import { useConsulta } from '../../../api/useConsulta';
import { formatearConSigno, formatearDuracion, formatearFecha, formatearHora, leerPesos } from '../../../comun/formato';
import { Aviso, Boton, CampoFormulario, ModalConfirmacion } from '../../../componentes';
import { useSesionStaff } from '../../../sesion/sesion';
import { useTurno } from './turno';
import { PaginaPanel, usePermisos } from '../PaginaPanel';
import panel from '../panel.module.css';
import clases from './caja.module.css';

const signo = (monto: number) => (monto > 0 ? clases.positivo : monto < 0 ? clases.negativo : undefined);

/** Ingresos, comisión, premios y resultado de un turno. */
export function BalanceTurno({ turno }: { turno: ResumenTurno }) {
  return (
    <dl className={clases.balance}>
      <dt>
        Ingresos ({turno.cantidadCargas} {turno.cantidadCargas === 1 ? 'carga' : 'cargas'})
      </dt>
      <dd>{formatearPesos(turno.ingresos)}</dd>
      <dt className={clases.desglose}>· Comisión (ganancia)</dt>
      <dd className={clases.desglose}>{formatearPesos(turno.comision)}</dd>
      <dt className={clases.desglose}>· Neto en fichas</dt>
      <dd className={clases.desglose}>{formatearPesos(turno.cargasNetas)}</dd>
      <dt>
        Premios pagados ({turno.cantidadRetiros} {turno.cantidadRetiros === 1 ? 'retiro' : 'retiros'})
      </dt>
      <dd className={turno.premios > 0 ? clases.negativo : undefined}>{formatearConSigno(-turno.premios)}</dd>
      <dt className={clases.total}>Resultado del turno</dt>
      <dd className={`${clases.total} ${signo(turno.resultado) ?? ''}`}>{formatearConSigno(turno.resultado)}</dd>
    </dl>
  );
}

/** Revisar y cerrar un turno: congela el balance y lo suma a la caja. */
export function CerrarTurno() {
  const { id = '' } = useParams();
  const { usuario } = useSesionStaff();
  const { tiene } = usePermisos();
  const { datos: turno, setDatos, error } = useConsulta(() => caja.turno(id), [id]);
  const [saldoTexto, setSaldoTexto] = useState('');
  const [nota, setNota] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [recienCerrado, setRecienCerrado] = useState(false);
  const cierre = useAccion(caja.cerrarTurno);
  const turnoActual = useTurno();

  const saldoInformado = saldoTexto.trim() ? leerPesos(saldoTexto) : null;
  const saldoInvalido = Boolean(saldoTexto.trim()) && saldoInformado === null;
  const propio = turno?.usuario.id === usuario?.id;
  const puedeCerrar = Boolean(turno && !turno.cerradoEn && (propio || tiene('turnos.cerrar_ajenos')));
  const diferencia = turno && saldoInformado !== null ? saldoInformado - (turno.cajaAlCerrar ?? 0) : null;

  async function cerrar() {
    const resultado = await cierre.ejecutar(id, { ...(saldoInformado !== null ? { saldoInformado } : {}), ...(nota.trim() ? { nota: nota.trim() } : {}) });
    if (resultado) {
      setDatos(resultado.valor);
      setConfirmando(false);
      setRecienCerrado(true);
      turnoActual?.recargar();
    }
  }

  const titulo = turno ? (turno.cerradoEn ? 'Turno cerrado' : 'Cerrar turno') : 'Turno';
  return (
    <PaginaPanel titulo={titulo} volver={<Link to={tiene('caja.ver') && !propio ? '/panel/caja' : '/panel/cola'}>← {tiene('caja.ver') && !propio ? 'Caja' : 'Cola'}</Link>}>
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      {recienCerrado ? (
        <Aviso tipo="ok">
          Turno cerrado. <Link to="/panel/cola">Volver a la cola</Link>
        </Aviso>
      ) : null}
      {turno ? (
        <>
          <p className={panel.explicacion}>
            {turno.usuario.nombre} · {formatearFecha(turno.abiertoEn)} de {formatearHora(turno.abiertoEn)} a {turno.cerradoEn ? formatearHora(turno.cerradoEn) : 'ahora'} ({formatearDuracion(turno.abiertoEn, turno.cerradoEn ?? Date.now())})
            {turno.cerradoPor && turno.cerradoPor.id !== turno.usuario.id ? ` · lo cerró ${turno.cerradoPor.nombre}` : ''}
          </p>
          <div className={panel.columnas}>
            <section className={panel.tarjeta} aria-labelledby="titulo-balance">
              <h2 id="titulo-balance">Balance del turno</h2>
              <BalanceTurno turno={turno} />
              <dl className={clases.recuadro}>
                <dt>Caja sin liquidar antes</dt>
                <dd className={signo(turno.cajaAntes)}>{formatearPesos(turno.cajaAntes)}</dd>
                <dt>{turno.cerradoEn ? 'Caja sin liquidar después' : 'Caja sin liquidar al cerrar'}</dt>
                <dd>{formatearPesos(turno.cajaAlCerrar ?? 0)}</dd>
              </dl>
              <p className={panel.explicacion}>La liquidación la registra quien administra la caja. Este saldo queda para el turno siguiente.</p>
            </section>

            <div className={panel.pila}>
              {turno.tomados.length > 0 ? (
                <section className={clases.pendientes} aria-labelledby="titulo-tomados">
                  <h2 id="titulo-tomados">
                    {turno.tomados.length === 1 ? 'Queda 1 pedido tomado' : `Quedan ${turno.tomados.length} pedidos tomados`}
                  </h2>
                  <ul>
                    {turno.tomados.map((p) => (
                      <li key={p.id}>
                        #{p.id} · {p.tipo === 'carga' ? 'Carga' : 'Retiro'} {formatearPesos(p.monto)}
                      </li>
                    ))}
                  </ul>
                  <p>Al cerrar se liberan y los termina el turno siguiente. Cuentan en el turno donde se acrediten o paguen.</p>
                </section>
              ) : null}

              {puedeCerrar ? (
                <section className={panel.tarjeta} aria-labelledby="titulo-control">
                  <h2 id="titulo-control">Control (opcional)</h2>
                  <CampoFormulario
                    etiqueta="Lo que hay realmente en la caja"
                    ayuda="Si lo cargás, queda registrada la diferencia con el balance."
                    inputMode="decimal"
                    placeholder={formatearPesos(turno.cajaAlCerrar ?? 0)}
                    value={saldoTexto}
                    onChange={(e) => setSaldoTexto(e.target.value)}
                    error={saldoInvalido ? 'Escribí un monto válido, por ejemplo 950.000' : undefined}
                  />
                  {diferencia !== null ? (
                    diferencia === 0 ? (
                      <Aviso tipo="ok">Coincide con el balance.</Aviso>
                    ) : (
                      <Aviso tipo="error">
                        {diferencia > 0 ? 'Sobran' : 'Faltan'} {formatearPesos(Math.abs(diferencia))}. Explicalo en la nota.
                      </Aviso>
                    )
                  ) : null}
                  <label className={panel.campoLibre}>
                    <span className={panel.etiquetaCampo}>Nota para el turno siguiente</span>
                    <textarea className={panel.areaTexto} value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500} />
                  </label>
                  <Boton onClick={() => setConfirmando(true)} disabled={saldoInvalido}>
                    Cerrar turno
                  </Boton>
                </section>
              ) : turno.cerradoEn ? (
                <section className={panel.tarjeta} aria-labelledby="titulo-cierre">
                  <h2 id="titulo-cierre">Cierre</h2>
                  <dl className={panel.datos}>
                    <dt>Cerrado</dt>
                    <dd>
                      {formatearFecha(turno.cerradoEn)} {formatearHora(turno.cerradoEn)}
                    </dd>
                    {turno.saldoInformado !== null ? (
                      <>
                        <dt>Informado</dt>
                        <dd>
                          {formatearPesos(turno.saldoInformado)}
                          {turno.saldoInformado !== turno.cajaAlCerrar ? ` (diferencia ${formatearConSigno(turno.saldoInformado - (turno.cajaAlCerrar ?? 0))})` : ' (coincide)'}
                        </dd>
                      </>
                    ) : null}
                    {turno.nota ? (
                      <>
                        <dt>Nota</dt>
                        <dd>{turno.nota}</dd>
                      </>
                    ) : null}
                  </dl>
                </section>
              ) : (
                <Aviso tipo="info">Este turno sigue abierto. Lo cierra {turno.usuario.nombre} o alguien con permiso para cerrar turnos ajenos.</Aviso>
              )}
            </div>
          </div>
        </>
      ) : null}

      {confirmando && turno ? (
        <ModalConfirmacion titulo="¿Cerrar el turno?" textoConfirmar="Cerrar turno" cargando={cierre.cargando} alCerrar={() => setConfirmando(false)} alConfirmar={() => void cerrar()}>
          <p>
            Se suma {formatearConSigno(turno.resultado)} a la caja, que queda en {formatearPesos(turno.cajaAlCerrar ?? 0)}.
            {turno.tomados.length === 1 ? ' Se libera el pedido tomado.' : turno.tomados.length > 1 ? ` Se liberan los ${turno.tomados.length} pedidos tomados.` : ''}
          </p>
          <p className={panel.explicacion}>Un turno cerrado no se modifica: si después aparece un error, se corrige con un ajuste en la caja.</p>
          {cierre.error ? <Aviso tipo="error">{cierre.error.message}</Aviso> : null}
        </ModalConfirmacion>
      ) : null}
    </PaginaPanel>
  );
}
