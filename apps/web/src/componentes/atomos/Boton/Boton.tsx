import type { ButtonHTMLAttributes, ReactNode } from 'react';
import clases from './Boton.module.css';

export type VarianteBoton = 'primario' | 'secundario' | 'peligro' | 'fantasma';

export interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton;
  tamano?: 'md' | 'lg';
  anchoCompleto?: boolean;
  icono?: ReactNode;
  /** Muestra que la acción está en curso y bloquea el botón. */
  cargando?: boolean;
}

export function Boton({
  variante = 'primario',
  tamano = 'md',
  anchoCompleto = false,
  icono,
  cargando = false,
  disabled,
  type = 'button',
  className,
  children,
  ...resto
}: BotonProps) {
  const clase = [
    clases.boton,
    clases[variante],
    clases[tamano],
    anchoCompleto ? clases.anchoCompleto : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={clase} disabled={disabled || cargando} aria-busy={cargando || undefined} {...resto}>
      {cargando ? <span className={clases.spinner} aria-hidden="true" /> : icono}
      {children}
    </button>
  );
}
