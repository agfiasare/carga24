/**
 * Reglas de dinero. Todos los montos son ENTEROS en centavos y todos los
 * porcentajes son enteros en puntos básicos (1 % = 100 pb), para evitar
 * errores de redondeo con decimales.
 */

export type Centavos = number;
export type PuntosBasicos = number;

/** Recargo: el jugador paga monto + comisión. Descuento: se le acredita monto − comisión. */
export type ModoComision = 'recargo' | 'descuento';

export interface CalculoCarga {
  /** Lo que transfiere el jugador. */
  pagado: Centavos;
  /** Lo que se le acredita en la plataforma. */
  acreditado: Centavos;
  /** Ganancia del negocio. */
  ganancia: Centavos;
}

function asegurarEntero(valor: number, nombre: string): void {
  if (!Number.isInteger(valor) || valor < 0) {
    throw new RangeError(`${nombre} debe ser un entero mayor o igual a 0 (recibido: ${valor})`);
  }
}

/** Aplica un porcentaje en puntos básicos, redondeando al centavo más cercano. */
export function aplicarPorcentaje(monto: Centavos, porcentaje: PuntosBasicos): Centavos {
  asegurarEntero(monto, 'monto');
  asegurarEntero(porcentaje, 'porcentaje');
  return Math.round((monto * porcentaje) / 10_000);
}

/**
 * Calcula una carga.
 * - recargo: `monto` es lo que el jugador quiere recibir.
 * - descuento: `monto` es lo que el jugador transfiere.
 */
export function calcularCarga(monto: Centavos, porcentaje: PuntosBasicos, modo: ModoComision): CalculoCarga {
  const ganancia = aplicarPorcentaje(monto, porcentaje);
  if (modo === 'recargo') return { pagado: monto + ganancia, acreditado: monto, ganancia };
  return { pagado: monto, acreditado: monto - ganancia, ganancia };
}

/** Comisión del operador = ganancia del pedido × porcentaje del operador. */
export function comisionOperador(ganancia: Centavos, porcentaje: PuntosBasicos): Centavos {
  return aplicarPorcentaje(ganancia, porcentaje);
}

/** Pasa pesos (por ejemplo, lo que se escribe en un campo) a centavos. */
export function pesosACentavos(pesos: number): Centavos {
  return Math.round(pesos * 100);
}

const formato = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Formatea centavos como pesos argentinos: 1050000 → "$ 10.500". */
export function formatearPesos(monto: Centavos): string {
  return formato.format(monto / 100);
}
