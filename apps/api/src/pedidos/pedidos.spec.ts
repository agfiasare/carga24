import { describe, expect, it } from 'vitest';
import { detectarTipo } from './archivos.js';
import { inicioDelDia } from './pedidos.service.js';

describe('detectarTipo', () => {
  it('reconoce fotos y PDF por sus primeros bytes', () => {
    expect(detectarTipo(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(detectarTipo(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png');
    expect(detectarTipo(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(detectarTipo(Buffer.from('%PDF-1.7\n'))).toBe('application/pdf');
  });

  it('rechaza lo demás aunque se llame .jpg', () => {
    expect(detectarTipo(Buffer.from('<script>alert(1)</script>'))).toBeNull();
    expect(detectarTipo(Buffer.from('GIF89a'))).toBeNull();
  });
});

describe('inicioDelDia', () => {
  it('usa el día de Argentina (UTC−3)', () => {
    // 02:00 UTC del 21 es todavía el 20 en Buenos Aires.
    expect(inicioDelDia(new Date('2026-11-21T02:00:00Z')).toISOString()).toBe('2026-11-20T03:00:00.000Z');
    expect(inicioDelDia(new Date('2026-11-21T15:00:00Z')).toISOString()).toBe('2026-11-21T03:00:00.000Z');
  });
});
