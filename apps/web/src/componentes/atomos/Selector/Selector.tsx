import { ChevronDown } from 'lucide-react';
import type { SelectHTMLAttributes } from 'react';
import clases from './Selector.module.css';

export interface SelectorProps extends SelectHTMLAttributes<HTMLSelectElement> {
  opciones: { valor: string; texto: string }[];
  /** Texto de la opción vacía (si se indica, se puede no elegir nada). */
  vacio?: string;
  invalido?: boolean;
}

/** Lista desplegable con el mismo aspecto que Campo. */
export function Selector({ opciones, vacio, invalido = false, className, ...resto }: SelectorProps) {
  return (
    <span className={[clases.contenedor, invalido ? clases.invalido : '', className ?? ''].filter(Boolean).join(' ')}>
      <select className={clases.selector} aria-invalid={invalido || undefined} {...resto}>
        {vacio !== undefined ? <option value="">{vacio}</option> : null}
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
      <ChevronDown size={18} aria-hidden="true" className={clases.flecha} />
    </span>
  );
}
