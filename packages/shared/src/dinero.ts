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
  /** Impuesto que retiene la plataforma (por ejemplo, ley 27.346) sobre lo transferido. */
  impuesto: Centavos;
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
 *
 * Al jugador se le cobra (o descuenta) el porcentaje sobre lo transferido. La ganancia de la
 * agencia es ese mismo porcentaje, pero sobre el neto: lo transferido menos el impuesto que
 * retiene la plataforma (`impuesto`, en puntos básicos; 0 = sin impuesto, ganancia = comisión).
 * Ejemplo con 3 % y 2,5 %: transfiere 100 → se acreditan 97; neto 97,50; ganancia 2,925.
 */
export function calcularCarga(monto: Centavos, porcentaje: PuntosBasicos, modo: ModoComision, impuesto: PuntosBasicos = 0): CalculoCarga {
  const comision = aplicarPorcentaje(monto, porcentaje);
  const pagado = modo === 'recargo' ? monto + comision : monto;
  const acreditado = modo === 'recargo' ? monto : monto - comision;
  const retenido = aplicarPorcentaje(pagado, impuesto);
  const ganancia = impuesto > 0 ? aplicarPorcentaje(pagado - retenido, porcentaje) : comision;
  return { pagado, acreditado, ganancia, impuesto: retenido };
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
