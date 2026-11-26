import { formatearPesos } from '@carga24/shared';
import { Clock } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { caja, type TurnoActual } from '../../../api/caja';
import { useAccion } from '../../../api/useAccion';
import { formatearConSigno, formatearDuracion, formatearFecha, formatearHora } from '../../../comun/formato';
import { Aviso, Boton, ModalConfirmacion } from '../../../componentes';
import { useSesionStaff } from '../../../sesion/sesion';
import panel from '../panel.module.css';
import clases from './caja.module.css';

const signo = (monto: number, positivo?: string, negativo?: string) => (monto > 0 ? positivo : monto < 0 ? negativo : '');

/**
 * Arriba de la cola: sin turno, el aviso para iniciarlo; con turno, lo que lleva
 * (ingresos, premios, resultado y caja) y el acceso al cierre.
 */
export function BarraTurno({ estado, alCambiar }: { estado: TurnoActual | undefined; alCambiar: () => void }) {
  const { usuario } = useSesionStaff();
  const [confirmando, setConfirmando] = useState(false);
  const apertura = useAccion(caja.abrirTurno);
  if (!estado) return null;
  const { turno } = estado;

  async function abrir() {
    if (await apertura.ejecutar()) {
      setConfirmando(false);
      alCambiar();
    }
  }

  if (!turno) {
    return (
      <section className={clases.sinTurno} aria-label="Turno">
        <Clock size={26} aria-hidden="true" />
        <div className={clases.sinTurnoTexto}>
          <strong>No tenés un turno abierto</strong>
          Podés ver la cola, pero para tomar, verificar, acreditar o pagar pedidos tenés que iniciar tu turno.
        </div>
        <Boton onClick={() => setConfirmando(true)}>Iniciar turno</Boton>
        {confirmando ? (
          <ModalConfirmacion
            titulo="Iniciar turno"
            textoConfirmar="Iniciar turno"
            cargando={apertura.cargando}
            alCerrar={() => setConfirmando(false)}
            alConfirmar={() => void abrir()}
          >
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
      </section>
    );
  }

  return (
    <section className={clases.barra} aria-label="Turno abierto">
      <div className={clases.estadoTurno}>
        <span className={clases.punto} aria-hidden="true" />
        <div className={clases.dato}>
          <strong>Turno abierto</strong>
          desde las {formatearHora(turno.abiertoEn)} ({formatearDuracion(turno.abiertoEn)})
        </div>
      </div>
      <div className={clases.dato}>
        Ingresos
        <strong>{formatearPesos(turno.ingresos)}</strong>
      </div>
      <div className={clases.dato}>
        Premios pagados
        <strong>{formatearPesos(turno.premios)}</strong>
      </div>
      <div className={clases.dato}>
        Resultado del turno
        <strong className={signo(turno.resultado, clases.positivoClaro, clases.negativoClaro)}>{formatearConSigno(turno.resultado)}</strong>
      </div>
      <div className={clases.dato}>
        Caja sin liquidar
        <strong className={clases.oro}>{formatearPesos(estado.caja + turno.resultado)}</strong>
      </div>
      <Link to={`/panel/turnos/${turno.id}`} className={clases.cerrar}>
        Cerrar turno
      </Link>
    </section>
  );
}
