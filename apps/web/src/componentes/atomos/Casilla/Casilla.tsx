import type { InputHTMLAttributes, ReactNode } from 'react';
import clases from './Casilla.module.css';

export interface CasillaProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  etiqueta: ReactNode;
  /** Texto chico debajo de la etiqueta. */
  detalle?: ReactNode;
}

/** Casilla de verificación con su etiqueta clickeable (área táctil completa). */
export function Casilla({ etiqueta, detalle, className, ...resto }: CasillaProps) {
  return (
    <label className={[clases.casilla, resto.disabled ? clases.deshabilitada : '', className ?? ''].filter(Boolean).join(' ')}>
      <input type="checkbox" className={clases.control} {...resto} />
      <span className={clases.textos}>
        <span>{etiqueta}</span>
        {detalle ? <span className={clases.detalle}>{detalle}</span> : null}
      </span>
    </label>
  );
}
