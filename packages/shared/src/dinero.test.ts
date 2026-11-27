import { describe, expect, it } from 'vitest';
import { aplicarPorcentaje, calcularCarga, comisionOperador, formatearPesos, pesosACentavos } from './dinero.js';

describe('calcularCarga', () => {
  it('recargo: quiere $10.000, paga $10.500 con 5 %', () => {
    expect(calcularCarga(1_000_000, 500, 'recargo')).toEqual({ pagado: 1_050_000, acreditado: 1_000_000, ganancia: 50_000, impuesto: 0 });
  });

  it('descuento: transfiere $1.000, se le acreditan $950 con 5 %', () => {
    expect(calcularCarga(100_000, 500, 'descuento')).toEqual({ pagado: 100_000, acreditado: 95_000, ganancia: 5_000, impuesto: 0 });
  });

  it('con impuesto de la plataforma: la ganancia es el % sobre lo transferido menos el impuesto', () => {
    // Transfiere $100, se le acreditan $97 (3 %); neto $97,50 (impuesto 2,5 %); ganancia 3 % de $97,50 = $2,925 → $2,93.
    expect(calcularCarga(10_000, 300, 'descuento', 250)).toEqual({ pagado: 10_000, acreditado: 9_700, ganancia: 293, impuesto: 250 });
    expect(calcularCarga(1_000_000, 300, 'descuento', 250)).toEqual({ pagado: 1_000_000, acreditado: 970_000, ganancia: 29_250, impuesto: 25_000 });
  });

  it('con 0 % no hay ganancia', () => {
    expect(calcularCarga(100_000, 0, 'recargo').ganancia).toBe(0);
  });
});

describe('aplicarPorcentaje', () => {
  it('redondea al centavo', () => {
    expect(aplicarPorcentaje(333, 500)).toBe(17);
  });

  it('rechaza montos con decimales o negativos', () => {
    expect(() => aplicarPorcentaje(10.5, 500)).toThrow(RangeError);
    expect(() => aplicarPorcentaje(-1, 500)).toThrow(RangeError);
  });
});

describe('comisionOperador', () => {
  it('20 % de una ganancia de $500 son $100', () => {
    expect(comisionOperador(50_000, 2_000)).toBe(10_000);
  });
});

describe('formato', () => {
  it('pasa pesos a centavos y los formatea', () => {
    const centavos = pesosACentavos(10_500);
    expect(centavos).toBe(1_050_000);
    expect(formatearPesos(centavos)).toContain('10.500');
  });
});
