import { formatearPesos } from '@carga24/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { caja, type EstadoCaja, type MovimientoCaja, type Turno } from '../../../api/caja';
import { useAccion } from '../../../api/useAccion';
import { useConsulta } from '../../../api/useConsulta';
import { formatearConSigno, formatearFecha, formatearHora, leerPesos } from '../../../comun/formato';
import { Aviso, Boton, CampoFormulario, ModalConfirmacion } from '../../../componentes';
import { PaginaPanel, usePermisos } from '../PaginaPanel';
import panel from '../panel.module.css';
import reportes from '../reportes.module.css';
import clases from './caja.module.css';

const signo = (monto: number) => (monto > 0 ? clases.positivo : monto < 0 ? clases.negativo : undefined);
const momento = (iso: string) => `${formatearFecha(iso)} ${formatearHora(iso)}`;

const TIPOS: Record<MovimientoCaja['tipo'], string> = { cierre_turno: 'Cierre de turno', liquidacion: 'Liquidación', ajuste: 'Ajuste', pedido_sin_turno: 'Sin turno' };

function detalleMovimiento(m: MovimientoCaja): string {
  if (m.tipo === 'cierre_turno' && m.turno) return `Turno de ${m.turno.usuario ?? '—'} (desde las ${formatearHora(m.turno.abiertoEn)})`;
  return m.nota ?? '—';
}

/** Saldo sin liquidar, turnos, liquidaciones y ajustes. */
export function Caja() {
  const { tiene } = usePermisos();
  const { datos, setDatos, error } = useConsulta(caja.estado, []);
  const [modal, setModal] = useState<'liquidar' | 'ajustar' | null>(null);

  return (
    <PaginaPanel
      titulo="Caja"
      requiere={['caja.ver']}
      acciones={
        <>
          {tiene('caja.ajustar') ? (
            <Boton variante="secundario" onClick={() => setModal('ajustar')}>
              Ajuste manual
            </Boton>
          ) : null}
          {tiene('caja.liquidar') ? <Boton onClick={() => setModal('liquidar')} disabled={!datos || datos.saldo <= 0}>Registrar liquidación</Boton> : null}
        </>
      }
    >
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      {datos ? (
        <>
          <div className={reportes.indicadores}>
            <div className={`${reportes.indicador} ${reportes.destacado}`}>
              <span className={reportes.indicadorTitulo}>Caja sin liquidar</span>
              <span className={reportes.indicadorValor}>{formatearPesos(datos.saldo)}</span>
              <span className={reportes.indicadorDetalle}>
                {datos.turnosSinLiquidar.length} {datos.turnosSinLiquidar.length === 1 ? 'turno cerrado' : 'turnos cerrados'} desde{' '}
                {datos.ultimaLiquidacion ? `la última liquidación (${momento(datos.ultimaLiquidacion)})` : 'el inicio'}
              </span>
            </div>
            <div className={reportes.indicador}>
              <span className={reportes.indicadorTitulo}>Turnos abiertos ahora</span>
              {datos.turnosAbiertos.length === 0 ? <span className={reportes.indicadorValor}>Ninguno</span> : null}
              {datos.turnosAbiertos.map((t) => (
                <span key={t.id}>
                  <Link to={`/panel/turnos/${t.id}`}>{t.usuario.nombre}</Link> · desde las {formatearHora(t.abiertoEn)} ·{' '}
                  <span className={signo(t.resultado)}>{formatearConSigno(t.resultado)}</span>
                </span>
              ))}
            </div>
            <div className={reportes.indicador}>
              <span className={reportes.indicadorTitulo}>Ganancia de la semana (comisión)</span>
              <span className={`${reportes.indicadorValor} ${clases.positivo}`}>{formatearPesos(datos.gananciaSemana)}</span>
              <span className={reportes.indicadorDetalle}>Desde el lunes</span>
            </div>
          </div>

          <section className={panel.tarjeta} aria-labelledby="titulo-sin-liquidar">
            <h2 id="titulo-sin-liquidar">Turnos sin liquidar</h2>
            <TablaTurnos turnos={datos.turnosSinLiquidar} />
          </section>

          <section className={panel.tarjeta} aria-labelledby="titulo-movimientos">
            <h2 id="titulo-movimientos">Movimientos de la caja</h2>
            {datos.movimientos.length === 0 ? (
              <p className={panel.vacio}>Todavía no hay movimientos.</p>
            ) : (
              <div className={panel.envoltorioTabla}>
                <table className={panel.tabla}>
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Detalle</th>
                      <th scope="col">Quién</th>
                      <th scope="col" className={reportes.numero}>Monto</th>
                      <th scope="col" className={reportes.numero}>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.movimientos.map((m) => (
                      <tr key={m.id}>
                        <td>{momento(m.creadoEn)}</td>
                        <td>
                          <span className={`${clases.insignia} ${clases[m.tipo] ?? ''}`}>{TIPOS[m.tipo]}</span>
                        </td>
                        <td>{m.tipo === 'cierre_turno' && m.turno ? <Link to={`/panel/turnos/${m.turno.id}`}>{detalleMovimiento(m)}</Link> : detalleMovimiento(m)}</td>
                        <td>{m.creadoPor ?? '—'}</td>
                        <td className={`${reportes.numero} ${signo(m.monto) ?? ''}`}>{formatearConSigno(m.monto)}</td>
                        <td className={reportes.numero}>
                          <strong>{formatearPesos(m.saldoPosterior)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}

      {modal === 'liquidar' && datos ? <ModalLiquidar saldo={datos.saldo} alCerrar={() => setModal(null)} alTerminar={(e) => { setDatos(e); setModal(null); }} /> : null}
      {modal === 'ajustar' && datos ? <ModalAjuste saldo={datos.saldo} alCerrar={() => setModal(null)} alTerminar={(e) => { setDatos(e); setModal(null); }} /> : null}
    </PaginaPanel>
  );
}

export function TablaTurnos({ turnos }: { turnos: Turno[] }) {
  if (turnos.length === 0) return <p className={panel.vacio}>No hay turnos cerrados sin liquidar.</p>;
  const total = turnos.reduce((suma, t) => suma + t.resultado, 0);
  return (
    <div className={panel.envoltorioTabla}>
      <table className={panel.tabla}>
        <thead>
          <tr>
            <th scope="col">Turno</th>
            <th scope="col">Quién</th>
            <th scope="col" className={reportes.numero}>Ingresos</th>
            <th scope="col" className={reportes.numero}>Comisión</th>
            <th scope="col" className={reportes.numero}>Premios</th>
            <th scope="col" className={reportes.numero}>Resultado</th>
          </tr>
        </thead>
        <tbody>
          {turnos.map((t) => (
            <tr key={t.id}>
              <td>
                <Link to={`/panel/turnos/${t.id}`}>
                  {formatearFecha(t.abiertoEn)} · {formatearHora(t.abiertoEn)} a {t.cerradoEn ? formatearHora(t.cerradoEn) : '…'}
                </Link>
              </td>
              <td>{t.usuario.nombre}</td>
              <td className={reportes.numero}>{formatearPesos(t.ingresos)}</td>
              <td className={reportes.numero}>{formatearPesos(t.comision)}</td>
              <td className={reportes.numero}>{formatearPesos(t.premios)}</td>
              <td className={`${reportes.numero} ${signo(t.resultado) ?? ''}`}>
                <strong>{formatearConSigno(t.resultado)}</strong>
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={5}>
              <strong>Total</strong>
            </td>
            <td className={reportes.numero}>
              <strong>{formatearConSigno(total)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

interface ModalCajaProps {
  saldo: number;
  alCerrar: () => void;
  alTerminar: (estado: EstadoCaja) => void;
}

function ModalLiquidar({ saldo, alCerrar, alTerminar }: ModalCajaProps) {
  const [montoTexto, setMontoTexto] = useState(formatearPesos(saldo).replace(/\$\s?/, ''));
  const [nota, setNota] = useState('');
  const liquidacion = useAccion(caja.liquidar);
  const monto = leerPesos(montoTexto);
  const excede = monto !== null && monto > saldo;

  async function confirmar() {
    if (!monto) return;
    const r = await liquidacion.ejecutar({ monto, ...(nota.trim() ? { nota: nota.trim() } : {}) });
    if (r) alTerminar(r.valor);
  }

  return (
    <ModalConfirmacion titulo="Registrar liquidación" textoConfirmar="Registrar liquidación" cargando={liquidacion.cargando} confirmarDeshabilitado={!monto || excede} alCerrar={alCerrar} alConfirmar={() => void confirmar()}>
      <dl className={clases.recuadro}>
        <dt>Caja sin liquidar</dt>
        <dd>{formatearPesos(saldo)}</dd>
      </dl>
      <CampoFormulario
        etiqueta="Monto que se liquida"
        ayuda="Propuesto: todo el saldo. Si liquidás una parte, el resto queda en la caja."
        inputMode="decimal"
        value={montoTexto}
        onChange={(e) => setMontoTexto(e.target.value)}
        error={montoTexto && !monto ? 'Escribí un monto válido' : excede ? 'No puede ser más que el saldo de la caja' : liquidacion.error?.delCampo('monto')}
      />
      <CampoFormulario etiqueta="Nota (opcional)" placeholder="Ej.: a caja de ahorro, operación 90127" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} />
      {monto && !excede ? (
        <p className={panel.explicacion}>
          Queda en la caja: <strong>{formatearPesos(saldo - monto)}</strong>
        </p>
      ) : null}
      {liquidacion.error && !liquidacion.error.delCampo('monto') ? <Aviso tipo="error">{liquidacion.error.message}</Aviso> : null}
    </ModalConfirmacion>
  );
}

function ModalAjuste({ saldo, alCerrar, alTerminar }: ModalCajaProps) {
  const [sentido, setSentido] = useState<'suma' | 'resta'>('resta');
  const [montoTexto, setMontoTexto] = useState('');
  const [nota, setNota] = useState('');
  const ajuste = useAccion(caja.ajustar);
  const monto = leerPesos(montoTexto);
  const conSigno = monto ? (sentido === 'suma' ? monto : -monto) : 0;

  async function confirmar() {
    if (!monto) return;
    const r = await ajuste.ejecutar({ monto: conSigno, nota: nota.trim() });
    if (r) alTerminar(r.valor);
  }

  return (
    <ModalConfirmacion titulo="Ajuste manual" textoConfirmar="Registrar ajuste" cargando={ajuste.cargando} confirmarDeshabilitado={!monto || nota.trim().length < 3} alCerrar={alCerrar} alConfirmar={() => void confirmar()}>
      <p className={panel.explicacion}>Para corregir la caja: un error en un turno ya cerrado, un gasto o un aporte. Queda en la auditoría.</p>
      <fieldset className={clases.segmentos} aria-label="Sentido">
        <Boton variante={sentido === 'resta' ? 'primario' : 'secundario'} aria-pressed={sentido === 'resta'} onClick={() => setSentido('resta')}>
          Resta
        </Boton>
        <Boton variante={sentido === 'suma' ? 'primario' : 'secundario'} aria-pressed={sentido === 'suma'} onClick={() => setSentido('suma')}>
          Suma
        </Boton>
      </fieldset>
      <CampoFormulario etiqueta="Monto" inputMode="decimal" placeholder="0" value={montoTexto} onChange={(e) => setMontoTexto(e.target.value)} error={montoTexto && !monto ? 'Escribí un monto válido' : undefined} />
      <CampoFormulario etiqueta="Motivo" placeholder="Ej.: pedido #1180 cargado con monto equivocado" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} error={ajuste.error?.delCampo('nota')} />
      {monto ? (
        <p className={panel.explicacion}>
          La caja pasa de {formatearPesos(saldo)} a <strong>{formatearPesos(saldo + conSigno)}</strong>.
        </p>
      ) : null}
      {ajuste.error && !ajuste.error.delCampo('nota') ? <Aviso tipo="error">{ajuste.error.message}</Aviso> : null}
    </ModalConfirmacion>
  );
}
