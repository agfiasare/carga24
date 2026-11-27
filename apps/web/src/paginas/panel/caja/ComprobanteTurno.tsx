import { formatearPesos } from '@carga24/shared';
import { Printer } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { caja, type ComprobanteTurno as Datos } from '../../../api/caja';
import { useConsulta } from '../../../api/useConsulta';
import { formatearConSigno, formatearFecha, formatearHora } from '../../../comun/formato';
import { Aviso, Boton } from '../../../componentes';
import { PaginaPanel } from '../PaginaPanel';
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
      {datos ? <Ticket t={datos} /> : null}
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
        <h3 className={clases.subtitulo}>DETALLE DE MOVIMIENTOS ({t.pedidos.length})</h3>
        {t.pedidos.length === 0 ? <p className={clases.centro}>Sin movimientos.</p> : null}
        <ol className={clases.movimientos}>
          {t.pedidos.map((p) => {
            const carga = p.tipo === 'carga';
            return (
              <li key={p.id}>
                <div className={clases.fila}>
                  <span>
                    {formatearHora(p.ejecutadoEn)} #{p.id} {carga ? 'CARGA' : 'RETIRO'}
                  </span>
                  <span>{formatearConSigno(carga ? (p.montoPagado ?? p.monto) : -p.monto)}</span>
                </div>
                <div className={`${clases.fila} ${clases.detalle}`}>
                  <span>
                    {p.jugador ?? '—'} · {p.canal === 'manual' ? 'WhatsApp' : 'web'}
                  </span>
                  <span>
                    {carga ? `fichas ${formatearPesos(p.monto)}` : `fichas ${formatearPesos(p.montoPagado ?? p.monto)}`}
                    {p.ganancia > 0 ? ` · gan. ${formatearPesos(p.ganancia)}` : ''}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
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
