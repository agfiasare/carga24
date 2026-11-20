import { useId } from 'react';
import { Selector, type SelectorProps } from '../../atomos/Selector/Selector';
import clases from './CampoFormulario.module.css';

export interface SelectorFormularioProps extends Omit<SelectorProps, 'id' | 'invalido'> {
  etiqueta: string;
  ayuda?: string;
  error?: string;
}

/** Selector con etiqueta, ayuda y error (misma estructura que CampoFormulario). */
export function SelectorFormulario({ etiqueta, ayuda, error, ...selector }: SelectorFormularioProps) {
  const id = useId();
  const idAyuda = ayuda ? `${id}-ayuda` : undefined;
  const idError = error ? `${id}-error` : undefined;
  return (
    <div className={clases.grupo}>
      <label htmlFor={id} className={clases.etiqueta}>
        {etiqueta}
      </label>
      <Selector id={id} invalido={Boolean(error)} aria-describedby={[idError, idAyuda].filter(Boolean).join(' ') || undefined} {...selector} />
      {error ? (
        <span id={idError} className={clases.error} role="alert">
          {error}
        </span>
      ) : null}
      {ayuda ? (
        <span id={idAyuda} className={clases.ayuda}>
          {ayuda}
        </span>
      ) : null}
    </div>
  );
}
