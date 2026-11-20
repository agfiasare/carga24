import type { ReactNode } from 'react';
import clases from './Etiqueta.module.css';

export type TonoEtiqueta = 'neutro' | 'ok' | 'aviso' | 'error';

export interface EtiquetaProps {
  tono?: TonoEtiqueta;
  children: ReactNode;
}

/** Píldora corta para estados y marcas ("Activo", "Bloqueado", "Sin 2FA"). */
export function Etiqueta({ tono = 'neutro', children }: EtiquetaProps) {
  return <span className={`${clases.etiqueta} ${clases[tono]}`}>{children}</span>;
}
