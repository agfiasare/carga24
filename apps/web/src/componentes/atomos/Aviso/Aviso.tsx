import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import clases from './Aviso.module.css';

export interface AvisoProps {
  tipo?: 'error' | 'ok' | 'info';
  children: ReactNode;
}

const ICONOS = { error: CircleAlert, ok: CircleCheck, info: Info };

/** Mensaje en bloque (errores de un formulario, confirmaciones). Los errores se anuncian a lectores de pantalla. */
export function Aviso({ tipo = 'info', children }: AvisoProps) {
  const Icono = ICONOS[tipo];
  return (
    <div className={`${clases.aviso} ${clases[tipo]}`} role={tipo === 'error' ? 'alert' : 'status'}>
      <Icono size={18} aria-hidden="true" className={clases.icono} />
      <div>{children}</div>
    </div>
  );
}
