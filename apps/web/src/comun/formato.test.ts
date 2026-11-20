import { describe, expect, it } from 'vitest';
import { formatearPorcentaje, formatearTelefono } from './formato';

describe('formato', () => {
  it('teléfonos', () => {
    expect(formatearTelefono('5491155550001')).toBe('+54 9 11 5555-0001');
    expect(formatearTelefono('5493514445566')).toBe('+54 9 3514445566');
    expect(formatearTelefono(null)).toBe('—');
  });

  it('porcentajes en puntos básicos', () => {
    expect(formatearPorcentaje(250)).toBe('2,5 %');
    expect(formatearPorcentaje(1000)).toBe('10 %');
  });
});
