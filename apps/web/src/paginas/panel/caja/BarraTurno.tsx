import { formatearPesos } from '@carga24/shared';
import { Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { caja } from '../../../api/caja';
import { useAccion } from '../../../api/useAccion';
import { formatearConSigno, formatearDuracion, formatearFecha, formatearHora } from '../../../comun/formato';
import { Aviso, Boton, ModalConfirmacion } from '../../../componentes';
import { useSesionStaff } from '../../../sesion/sesion';
import panel from '../panel.module.css';
import clases from './caja.module.css';
import { useTurno } from './turno';

const signo = (monto: number, positivo?: string, negativo?: string) => (monto > 0 ? positivo : monto < 0 ? negativo : undefined);

const formatoDia = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });

/** Hora de Argentina, que se actualiza sola. */
function Reloj() {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const intervalo = setInterval(() => setAhora(new Date()), 15_000);
    return () => clearInterval(intervalo);
  }, []);
  const dia = formatoDia.format(ahora).replace(',', '').replace('-', '/');
  return (
    <span className={clases.reloj}>
      <Clock size={16} aria-hidden="true" />
      <span className={clases.dia}>{dia}</span>
      <time dateTime={ahora.toISOString()}>
        <strong>{formatearHora(ahora.toISOString())}</strong>
      </time>
    </span>
  );
}

/**
 * Barra de arriba en todo el panel: la hora y el turno (iniciar, lo que lleva y cerrar).
 * Quien no necesita turno (permiso turnos.opcional) lo ve como opcional.
 */
export function BarraTurno() {
  const contexto = useTurno();
  const { usuario } = useSesionStaff();
  const [confirmando, setConfirmando] = useState(false);
  const apertura = useAccion(caja.abrirTurno);
  if (!contexto) return null;
  const { estado, recargar } = contexto;

  async function abrir() {
    if (await apertura.ejecutar()) {
      setConfirmando(false);
      recargar();
    }
  }

  const turno = estado?.turno;
  return (
    <div className={clases.barraSuperior} role="region" aria-label="Turno">
      <Reloj />
      {!estado ? null : turno ? (
        <div className={clases.turnoAbierto}>
          <span className={clases.estadoTurno}>
            <span className={clases.punto} aria-hidden="true" />
            <span>
              <strong>Turno abierto</strong> desde las {formatearHora(turno.abiertoEn)} <span className={clases.duracion}>({formatearDuracion(turno.abiertoEn)})</span>
            </span>
          </span>
          <span className={clases.dato}>
            Ingresos <strong>{formatearPesos(turno.ingresos)}</strong>
          </span>
          <span className={clases.dato}>
            Premios <strong>{formatearPesos(turno.premios)}</strong>
          </span>
          <span className={clases.dato}>
            Resultado <strong className={signo(turno.resultado, clases.positivo, clases.negativo)}>{formatearConSigno(turno.resultado)}</strong>
          </span>
          <Link to={`/panel/turnos/${turno.id}`} className={clases.cerrar}>
            Cerrar turno
          </Link>
        </div>
      ) : (
        <div className={clases.turnoAbierto}>
          {estado.requiereTurno ? (
            <span className={clases.sinTurno}>Sin turno: iniciá uno para operar</span>
          ) : (
            <span className={clases.opcional}>Operás sin turno: lo que acredites o pagues va directo a la caja</span>
          )}
          <Boton variante={estado.requiereTurno ? 'primario' : 'secundario'} onClick={() => setConfirmando(true)}>
            Iniciar turno
          </Boton>
        </div>
      )}

      {confirmando && estado ? (
        <ModalConfirmacion titulo="Iniciar turno" textoConfirmar="Iniciar turno" cargando={apertura.cargando} alCerrar={() => setConfirmando(false)} alConfirmar={() => void abrir()}>
          <dl className={panel.datos}>
            <dt>Quién</dt>
            <dd>{usuario?.nombreVisible ?? usuario?.nombreUsuario}</dd>
            <dt>Turno anterior</dt>
            <dd>{estado.ultimoCierre ? `${estado.ultimoCierre.usuario ?? '—'} · cerrado el ${formatearFecha(estado.ultimoCierre.cerradoEn)} a las ${formatearHora(estado.ultimoCierre.cerradoEn)}` : 'Es el primero'}</dd>
            <dt>Caja sin liquidar</dt>
            <dd className={signo(estado.caja, clases.positivo, clases.negativo)}>{formatearPesos(estado.caja)}</dd>
          </dl>
          <p className={panel.explicacion}>Lo que acredites y pagues en tu turno se suma a esa caja. Al irte, cerrá el turno.</p>
          {apertura.error ? <Aviso tipo="error">{apertura.error.message}</Aviso> : null}
        </ModalConfirmacion>
      ) : null}
    </div>
  );
}
