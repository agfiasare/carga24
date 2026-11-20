import { useEffect } from 'react';
import { Link } from 'react-router';
import { portal } from '../../../api/portal';
import { useConsulta } from '../../../api/useConsulta';
import { formatearFecha, formatearHora } from '../../../comun/formato';
import { Aviso } from '../../../componentes';
import { usePortalEnVivo } from '../../../sesion/portalEnVivo';
import { PaginaJugador } from './comun';
import clases from './portal.module.css';

/** Avisos de los pedidos. Al abrir la página se marcan como leídos (se resaltan los nuevos). */
export function Avisos() {
  const { version, actualizarAvisos } = usePortalEnVivo();
  const { datos, error } = useConsulta(portal.avisos, [version]);

  useEffect(() => {
    if (datos && datos.noLeidas > 0) portal.marcarLeidas().then(actualizarAvisos, () => undefined);
  }, [datos, actualizarAvisos]);

  return (
    <PaginaJugador titulo="Avisos">
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      <div className={clases.lista}>
        {datos?.avisos.map((a) => {
          const contenido = (
            <>
              <strong>{a.titulo}</strong>
              {a.texto ? <span>{a.texto}</span> : null}
              <span className={clases.secundario}>
                {formatearFecha(a.creadoEn)} {formatearHora(a.creadoEn)}
              </span>
            </>
          );
          const clase = `${clases.aviso} ${a.leidaEn ? '' : clases.noLeido}`;
          return a.pedidoId ? (
            <Link key={a.id} to={`/pedidos/${a.pedidoId}`} className={clase}>
              {contenido}
            </Link>
          ) : (
            <div key={a.id} className={clase}>
              {contenido}
            </div>
          );
        })}
      </div>
      {datos && datos.avisos.length === 0 ? <p className={clases.vacio}>No tenés avisos.</p> : null}
    </PaginaJugador>
  );
}
