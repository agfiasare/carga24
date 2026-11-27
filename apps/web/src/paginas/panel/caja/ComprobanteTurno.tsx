import { formatearPesos } from '@carga24/shared';
import { Printer } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { caja, type ComprobanteTurno as Datos } from '../../../api/caja';
import { useConsulta } from '../../../api/useConsulta';
import { formatearConSigno, formatearFecha, formatearHora } from '../../../comun/formato';
import { Aviso, Boton } from '../../../componentes';
import { DetallePedido } from '../cola/DetallePedido';
import { PaginaPanel, usePermisos } from '../PaginaPanel';
import panel from '../panel.module.css';
import reportes from '../reportes.module.css';
import clases from './comprobante.module.css';

const segundos = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: 'America/Argentina/Buenos_Aires' });
const momento = (iso: string) => `${formatearFecha(iso)} ${segundos.format(new Date(iso))}`;

function Fila({ etiqueta, valor, fuerte = false, sangria = false }: { etiqueta: string; valor: string; fuerte?: boolean; sangria?: boolean }) {
  return (
    <div className={`${clases.fila} ${fuerte ? clases.fuerte : ''} ${sangria ? clases.sangria : ''}`}>
      <span>{etiqueta}</span>
      <span>{valor}</span>
    </div>
  );
}

/** Comprobante del turno con formato de ticket (como el de la plataforma), para ver o imprimir. */
export function ComprobanteTurno() {
  const { id = '' } = useParams();
  const { datos, error } = useConsulta(() => caja.comprobante(id), [id]);
  return (
    <PaginaPanel
      titulo="Comprobante de turno"
      volver={<Link to={`/panel/turnos/${id}`}>← Turno</Link>}
      acciones={
        <Boton variante="secundario" icono={<Printer size={18} aria-hidden="true" />} onClick={() => window.print()}>
          Imprimir
        </Boton>
      }
    >
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      {datos ? (
        <div className={clases.disposicion}>
          <Ticket t={datos} />
          <Movimientos t={datos} />
        </div>
      ) : null}
    </PaginaPanel>
  );
}

export function Ticket({ t }: { t: Datos }) {
  const comisionRetiros = t.retirosFichas - t.premios;
  const rdoNeto = t.cargasNetas - t.retirosFichas;
  return (
    <article className={clases.ticket} aria-label="Comprobante">
      <header className={clases.cabecera}>
        <img src="/marca/carga24-logo-oro.png" alt="Carga24" className={clases.logo} />
        <div className={clases.estrellas} aria-hidden="true">
          ************************
        </div>
        <h2 className={clases.titulo}>COMPROBANTE DE TURNO</h2>
        <div className={clases.estrellas} aria-hidden="true">
          ************************
        </div>
        <div>ID {t.id.slice(0, 8).toUpperCase()}</div>
      </header>

      <section className={clases.bloque}>
        <Fila etiqueta="INICIA:" valor={momento(t.abiertoEn)} />
        <Fila etiqueta="CIERRA:" valor={t.cerradoEn ? momento(t.cerradoEn) : 'turno abierto'} />
        <Fila etiqueta="OPERADOR/A:" valor={t.usuario.nombre} />
        {t.cerradoPor && t.cerradoPor.id !== t.usuario.id ? <Fila etiqueta="CERRÓ:" valor={t.cerradoPor.nombre} /> : null}
      </section>

      <section className={clases.bloque} aria-label="Cargas">
        <Fila etiqueta={`${t.cantidadCargas} CARGAS:`} valor={formatearPesos(t.ingresos)} fuerte />
        <Fila etiqueta="acreditado en fichas" valor={formatearPesos(t.cargasNetas)} sangria />
        {t.impuesto > 0 ? <Fila etiqueta="impuesto plataforma" valor={formatearPesos(t.impuesto)} sangria /> : null}
      </section>

      <section className={clases.bloque} aria-label="Retiros">
        <Fila etiqueta={`${t.cantidadRetiros} RETIROS:`} valor={formatearPesos(t.retirosFichas)} fuerte />
        <Fila etiqueta="transferido" valor={formatearPesos(t.premios)} sangria />
        {comisionRetiros > 0 ? <Fila etiqueta="comisión de retiro" valor={formatearPesos(comisionRetiros)} sangria /> : null}
      </section>

      <section className={clases.bloque} aria-label="Resultado">
        <Fila etiqueta="GANANCIA:" valor={formatearPesos(t.comision)} />
        <Fila etiqueta="RDO NETO (plataforma):" valor={formatearConSigno(rdoNeto)} fuerte />
        <Fila etiqueta="RESULTADO CAJA:" valor={formatearConSigno(t.resultado)} fuerte />
        <Fila etiqueta="caja antes" valor={formatearPesos(t.cajaAntes)} sangria />
        <Fila etiqueta={t.cerradoEn ? 'caja después' : 'caja al cerrar'} valor={formatearPesos(t.cajaAlCerrar ?? 0)} sangria />
        {t.saldoInformado !== null ? (
          <>
            <Fila etiqueta="INFORMADO:" valor={formatearPesos(t.saldoInformado)} />
            <Fila etiqueta="diferencia" valor={formatearConSigno(t.saldoInformado - (t.cajaAlCerrar ?? 0))} sangria />
          </>
        ) : null}
        {t.nota ? <p className={clases.nota}>NOTA: {t.nota}</p> : null}
      </section>

      <section className={clases.bloque} aria-label="Movimientos">
        <Fila etiqueta="MOVIMIENTOS:" valor={String(t.pedidos.length)} fuerte />
      </section>

      <footer className={clases.pie}>
        <div>Emitido {momento(new Date().toISOString())}</div>
        <div className={clases.firma}>Firma: ______________________</div>
        <div className={clases.estrellas} aria-hidden="true">
          ************************
        </div>
      </footer>
    </article>
  );
}

/** Cada pedido acreditado o pagado en el turno, con su detalle; el número abre el pedido. */
function Movimientos({ t }: { t: Datos }) {
  const { tiene } = usePermisos();
  const [abierto, setAbierto] = useState<number | null>(null);
  const total = (f: (p: Datos['pedidos'][number]) => number) => t.pedidos.reduce((n, p) => n + f(p), 0);
  const transferido = (p: Datos['pedidos'][number]) => (p.tipo === 'carga' ? (p.montoPagado ?? p.monto) : -p.monto);
  const fichas = (p: Datos['pedidos'][number]) => (p.tipo === 'carga' ? p.monto : -(p.montoPagado ?? p.monto));
  return (
    <section className={`${panel.tarjeta} ${clases.movimientosLado}`} aria-labelledby="titulo-movimientos">
      <h2 id="titulo-movimientos">Movimientos del turno ({t.pedidos.length})</h2>
      {t.pedidos.length === 0 ? (
        <p className={panel.explicacion}>
          No hubo cargas acreditadas ni retiros pagados con este turno abierto. Lo que se opera sin turno (permiso "Operar pedidos sin abrir turno") va directo a la caja y no
          aparece acá.
        </p>
      ) : (
        <div className={panel.envoltorioTabla}>
          <table className={panel.tabla}>
            <thead>
              <tr>
                <th scope="col">Hora</th>
                <th scope="col">Pedido</th>
                <th scope="col">Jugador</th>
                <th scope="col">Canal</th>
                <th scope="col" className={reportes.numero}>Dinero</th>
                <th scope="col" className={reportes.numero}>Fichas</th>
                <th scope="col" className={reportes.numero}>Impuesto</th>
                <th scope="col" className={reportes.numero}>Ganancia</th>
              </tr>
            </thead>
            <tbody>
              {t.pedidos.map((p) => {
                const texto = `${p.tipo === 'carga' ? 'Carga' : 'Retiro'} #${p.id}`;
                return (
                  <tr key={p.id}>
                    <td>{formatearHora(p.ejecutadoEn)}</td>
                    <td>
                      {tiene('pedidos.ver') ? (
                        <button type="button" className={panel.enlaceBoton} onClick={() => setAbierto(p.id)}>
                          {texto}
                        </button>
                      ) : (
                        texto
                      )}
                    </td>
                    <td>{p.jugador ?? '—'}</td>
                    <td>{p.canal === 'manual' ? 'WhatsApp' : 'Web'}</td>
                    <td className={reportes.numero}>{formatearConSigno(transferido(p))}</td>
                    <td className={reportes.numero}>{formatearConSigno(fichas(p))}</td>
                    <td className={reportes.numero}>{p.impuesto ? formatearPesos(p.impuesto) : '—'}</td>
                    <td className={reportes.numero}>{p.ganancia ? formatearPesos(p.ganancia) : '—'}</td>
                  </tr>
                );
              })}
              <tr>
                <td colSpan={4}>
                  <strong>Total</strong>
                </td>
                <td className={reportes.numero}>
                  <strong>{formatearConSigno(total(transferido))}</strong>
                </td>
                <td className={reportes.numero}>
                  <strong>{formatearConSigno(total(fichas))}</strong>
                </td>
                <td className={reportes.numero}>
                  <strong>{formatearPesos(total((p) => p.impuesto))}</strong>
                </td>
                <td className={reportes.numero}>
                  <strong>{formatearPesos(total((p) => p.ganancia))}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className={panel.explicacion}>Dinero: lo que entró o salió de la cuenta. Fichas: lo que se cargó o salió de la plataforma (su total es el RDO neto).</p>
      {abierto !== null ? <DetallePedido id={abierto} alCerrar={() => setAbierto(null)} /> : null}
    </section>
  );
}
