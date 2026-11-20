import { Pin } from 'lucide-react';
import { portal } from '../../../api/portal';
import { useConsulta } from '../../../api/useConsulta';
import { formatearFecha } from '../../../comun/formato';
import { Aviso } from '../../../componentes';
import { PaginaJugador } from './comun';
import clases from './portal.module.css';

export function Novedades() {
  const { datos, error } = useConsulta(portal.novedades, []);
  return (
    <PaginaJugador titulo="Novedades">
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      {datos?.map((n) => (
        <article key={n.id} className={`${clases.tarjeta} ${n.fijada ? clases.destacada : ''}`} aria-labelledby={`novedad-${n.id}`}>
          <span className={clases.secundario}>
            {n.fijada ? (
              <>
                <Pin size={14} aria-hidden="true" /> Fijada ·{' '}
              </>
            ) : null}
            {n.publicadaEn ? formatearFecha(n.publicadaEn) : ''}
          </span>
          <h2 id={`novedad-${n.id}`}>{n.titulo}</h2>
          <p className={clases.novedad}>{n.texto}</p>
        </article>
      ))}
      {datos && datos.length === 0 ? <p className={clases.vacio}>Por ahora no hay novedades.</p> : null}
    </PaginaJugador>
  );
}
