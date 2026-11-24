import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import clases from './Campo.module.css';

export interface CampoProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Ícono al inicio del campo (decorativo). */
  icono?: ReactNode;
  invalido?: boolean;
  /** Para darle foco desde afuera (React 19 pasa ref como una prop más). */
  ref?: Ref<HTMLInputElement>;
}

/** Campo de texto base. Para usarlo con etiqueta y mensajes, ver la molécula CampoFormulario. */
export function Campo({ icono, invalido = false, className, ref, ...resto }: CampoProps) {
  return (
    <span className={[clases.contenedor, invalido ? clases.invalido : '', className ?? ''].filter(Boolean).join(' ')}>
      {icono ? (
        <span className={clases.icono} aria-hidden="true">
          {icono}
        </span>
      ) : null}
      <input ref={ref} className={clases.campo} aria-invalid={invalido || undefined} {...resto} />
    </span>
  );
}
