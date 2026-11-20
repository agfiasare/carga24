import { HttpException } from '@nestjs/common';
import { beforeAll, describe, expect, it } from 'vitest';
import { cifrar, descifrar, generarContrasenaTemporal, hashToken } from './cripto.js';
import { LimitadorIntentos } from './limitador.js';
import { normalizarTelefono, pareceTelefono } from './telefono.js';
import { codificarBase32, decodificarBase32, generarCodigo, verificarCodigo } from './totp.js';

describe('normalizarTelefono', () => {
  it('lleva distintas formas del mismo celular al mismo valor', () => {
    expect(normalizarTelefono('11 5555-0001')).toBe('5491155550001');
    expect(normalizarTelefono('+54 9 11 5555 0001')).toBe('5491155550001');
    expect(normalizarTelefono('011 5555 0001')).toBe('5491155550001');
  });

  it('rechaza lo que no es un teléfono', () => {
    expect(normalizarTelefono('hola')).toBeNull();
    expect(normalizarTelefono('1234')).toBeNull();
  });

  it('distingue teléfonos de nombres de usuario', () => {
    expect(pareceTelefono('11 5555 0001')).toBe(true);
    expect(pareceTelefono('juanperez')).toBe(false);
  });
});

describe('TOTP (vectores del RFC 6238)', () => {
  // Secreto del RFC: "12345678901234567890" en ASCII.
  const secreto = codificarBase32(Buffer.from('12345678901234567890'));

  it('codifica y decodifica base32', () => {
    expect(decodificarBase32(secreto).toString()).toBe('12345678901234567890');
  });

  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ])('en t=%i el código es %s', (segundos, codigo) => {
    expect(generarCodigo(secreto, segundos * 1000)).toBe(codigo);
  });

  it('acepta un paso de desfase y rechaza códigos viejos', () => {
    const t = 1111111109 * 1000;
    expect(verificarCodigo(secreto, generarCodigo(secreto, t - 30_000), t)).toBe(true);
    expect(verificarCodigo(secreto, generarCodigo(secreto, t - 120_000), t)).toBe(false);
    expect(verificarCodigo(secreto, 'abc123', t)).toBe(false);
  });
});

describe('cripto', () => {
  beforeAll(() => {
    process.env.CLAVE_CIFRADO = Buffer.alloc(32, 7).toString('base64');
  });

  it('cifra y descifra', () => {
    const cifrado = cifrar('SECRETO2FA');
    expect(cifrado).not.toContain('SECRETO2FA');
    expect(descifrar(cifrado)).toBe('SECRETO2FA');
  });

  it('detecta datos alterados', () => {
    const [iv, tag, datos] = cifrar('x').split('.');
    expect(() => descifrar([iv, tag, `${datos}A`].join('.'))).toThrow();
  });

  it('genera contraseñas temporales legibles y hashes estables', () => {
    expect(generarContrasenaTemporal()).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{4}$/);
    expect(hashToken('a')).toBe(hashToken('a'));
  });
});

describe('LimitadorIntentos', () => {
  it('bloquea al octavo fallo y libera pasada la ventana', () => {
    const limitador = new LimitadorIntentos();
    for (let i = 0; i < 8; i++) limitador.registrarFallo('clave', 0);
    expect(() => limitador.verificar('clave', 1000)).toThrow(HttpException);
    expect(() => limitador.verificar('clave', LimitadorIntentos.VENTANA_MS + 1)).not.toThrow();
  });
});
