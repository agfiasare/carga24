import { describe, expect, it } from 'vitest';
import { formatearHace, formatearHora, formatearPorcentaje, formatearTelefono } from './formato';

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

describe('formatearHace', () => {
  it('dice hace cuánto pasó', () => {
    const ahora = Date.parse('2026-11-20T15:00:00Z');
    expect(formatearHace('2026-11-20T14:59:40Z', ahora)).toBe('recién');
    expect(formatearHace('2026-11-20T14:55:00Z', ahora)).toBe('hace 5 min');
    expect(formatearHace('2026-11-20T12:00:00Z', ahora)).toBe('hace 3 h');
  });
});

describe('formatearHora', () => {
  it('usa 24 horas y la hora de Argentina', () => {
    expect(formatearHora('2026-11-20T03:28:00Z')).toBe('00:28');
    expect(formatearHora('2026-11-20T18:05:00Z')).toBe('15:05');
  });
});
