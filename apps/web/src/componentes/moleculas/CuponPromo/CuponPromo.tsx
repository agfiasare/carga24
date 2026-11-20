import { Ticket } from 'lucide-react';
import type { ReactNode } from 'react';
import clases from './CuponPromo.module.css';

export interface CuponPromoProps {
  titulo: string;
  condiciones: string;
  codigo: string;
  /** Texto de vigencia, por ejemplo "Hasta el 22/11". */
  vigencia?: string;
  /** Acción del talón (por ejemplo, un botón para copiar el código). */
  accion?: ReactNode;
}

/** La promo como cupón dorado: cuerpo con el beneficio y talón troquelado con el código. */
export function CuponPromo({ titulo, condiciones, codigo, vigencia, accion }: CuponPromoProps) {
  return (
    <article className={clases.cupon} aria-label={`Promo ${titulo}, código ${codigo}`}>
      <div className={clases.cuerpo}>
        <span className={clases.marca}>
          <Ticket size={14} aria-hidden="true" /> Promo
        </span>
        <strong className={clases.titulo}>{titulo}</strong>
        <span className={clases.condiciones}>{condiciones}</span>
      </div>
      <div className={clases.talon}>
        <span className={clases.etiqueta}>Código</span>
        <strong className={clases.codigo}>{codigo}</strong>
        {vigencia ? <span className={clases.vigencia}>{vigencia}</span> : null}
        {accion}
      </div>
    </article>
  );
}
