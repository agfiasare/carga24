import type { InputHTMLAttributes, ReactNode } from 'react';
import clases from './Campo.module.css';

export interface CampoProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Ícono al inicio del campo (decorativo). */
  icono?: ReactNode;
  invalido?: boolean;
}

/** Campo de texto base. Para usarlo con etiqueta y mensajes, ver la molécula CampoFormulario. */
export function Campo({ icono, invalido = false, className, ...resto }: CampoProps) {
  return (
    <span className={[clases.contenedor, invalido ? clases.invalido : '', className ?? ''].filter(Boolean).join(' ')}>
      {icono ? (
        <span className={clases.icono} aria-hidden="true">
          {icono}
        </span>
      ) : null}
      <input className={clases.campo} aria-invalid={invalido || undefined} {...resto} />
    </span>
  );
}
