import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Códigos de un solo uso por tiempo (TOTP, RFC 6238): los que generan
 * Google Authenticator, Microsoft Authenticator, Authy, etc.
 */

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PASO_SEGUNDOS = 30;
const DIGITOS = 6;

export function codificarBase32(datos: Buffer): string {
  let bits = 0;
  let valor = 0;
  let salida = '';
  for (const byte of datos) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      salida += BASE32[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) salida += BASE32[(valor << (5 - bits)) & 31];
  return salida;
}

export function decodificarBase32(texto: string): Buffer {
  const limpio = texto.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let valor = 0;
  const bytes: number[] = [];
  for (const caracter of limpio) {
    const indice = BASE32.indexOf(caracter);
    if (indice === -1) throw new Error('Secreto base32 inválido');
    valor = (valor << 5) | indice;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Secreto nuevo de 160 bits, en base32. */
export function generarSecreto(): string {
  return codificarBase32(randomBytes(20));
}

export function generarCodigo(secretoBase32: string, momentoMs: number = Date.now()): string {
  const contador = Math.floor(momentoMs / 1000 / PASO_SEGUNDOS);
  const mensaje = Buffer.alloc(8);
  mensaje.writeBigUInt64BE(BigInt(contador));
  const hmac = createHmac('sha1', decodificarBase32(secretoBase32)).update(mensaje).digest();
  const desplazamiento = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const numero = hmac.readUInt32BE(desplazamiento) & 0x7fffffff;
  return String(numero % 10 ** DIGITOS).padStart(DIGITOS, '0');
}

/** Acepta el código actual y el de un paso antes o después (relojes levemente desfasados). */
export function verificarCodigo(secretoBase32: string, codigo: string, momentoMs: number = Date.now()): boolean {
  if (!/^\d{6}$/.test(codigo)) return false;
  for (const desfase of [-1, 0, 1]) {
    const esperado = generarCodigo(secretoBase32, momentoMs + desfase * PASO_SEGUNDOS * 1000);
    if (timingSafeEqual(Buffer.from(esperado), Buffer.from(codigo))) return true;
  }
  return false;
}

/** Dirección otpauth:// para mostrar como código QR en la app de autenticación. */
export function uriOtpauth(secretoBase32: string, cuenta: string, emisor = 'Carga24'): string {
  const etiqueta = encodeURIComponent(`${emisor}:${cuenta}`);
  const parametros = new URLSearchParams({ secret: secretoBase32, issuer: emisor, digits: String(DIGITOS), period: String(PASO_SEGUNDOS) });
  return `otpauth://totp/${etiqueta}?${parametros.toString()}`;
}
