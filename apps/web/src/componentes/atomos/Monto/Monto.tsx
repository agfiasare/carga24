import { formatearPesos, type Centavos } from '@carga24/shared';
import clases from './Monto.module.css';

export interface MontoProps {
  /** Monto en centavos (entero). */
  centavos: Centavos;
  /** "entrada" muestra +$ en verde (carga acreditada); "salida" muestra −$ (retiro). */
  movimiento?: 'entrada' | 'salida';
  tamano?: 'sm' | 'md' | 'lg';
  /** Monto destacado en oro (por ejemplo, el pedido en curso). */
  destacado?: boolean;
  tachado?: boolean;
}

export function Monto({ centavos, movimiento, tamano = 'md', destacado = false, tachado = false }: MontoProps) {
  const signo = movimiento === 'entrada' ? '+' : movimiento === 'salida' ? '−' : '';
  const clase = [
    clases.monto,
    clases[tamano],
    movimiento === 'entrada' ? clases.entrada : '',
    destacado ? clases.destacado : '',
    tachado ? clases.tachado : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={clase}>
      {signo}
      {formatearPesos(centavos)}
    </span>
  );
}
