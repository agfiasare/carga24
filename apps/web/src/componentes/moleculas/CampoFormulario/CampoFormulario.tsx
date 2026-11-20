import { useId } from 'react';
import { Campo, type CampoProps } from '../../atomos/Campo/Campo';
import clases from './CampoFormulario.module.css';

export interface CampoFormularioProps extends Omit<CampoProps, 'id' | 'invalido'> {
  etiqueta: string;
  ayuda?: string;
  error?: string;
}

/** Campo con etiqueta, texto de ayuda y mensaje de error, conectados para lectores de pantalla. */
export function CampoFormulario({ etiqueta, ayuda, error, ...campo }: CampoFormularioProps) {
  const id = useId();
  const idAyuda = ayuda ? `${id}-ayuda` : undefined;
  const idError = error ? `${id}-error` : undefined;
  const descripcion = [idError, idAyuda].filter(Boolean).join(' ') || undefined;

  return (
    <div className={clases.grupo}>
      <label htmlFor={id} className={clases.etiqueta}>
        {etiqueta}
      </label>
      <Campo id={id} invalido={Boolean(error)} aria-describedby={descripcion} {...campo} />
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
