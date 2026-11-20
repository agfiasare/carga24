import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from 'node:crypto';

/** Token aleatorio para cookies de sesión (se guarda solo su hash). */
export function generarToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Sin letras ni números que se confundan (0/O, 1/I/L).
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Contraseña temporal fácil de dictar: "K7M-29QX". */
export function generarContrasenaTemporal(): string {
  const parte = (n: number) => Array.from({ length: n }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
  return `${parte(3)}-${parte(4)}`;
}

function clave(): Buffer {
  const base64 = process.env.CLAVE_CIFRADO;
  if (!base64) throw new Error('Falta CLAVE_CIFRADO (32 bytes en base64) para cifrar los secretos de 2FA');
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length !== 32) throw new Error('CLAVE_CIFRADO tiene que ser de 32 bytes en base64');
  return buffer;
}

/** Cifra un texto con AES-256-GCM. Formato: iv.tag.datos (base64url). */
export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cifrador = createCipheriv('aes-256-gcm', clave(), iv);
  const datos = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);
  return [iv, cifrador.getAuthTag(), datos].map((b) => b.toString('base64url')).join('.');
}

export function descifrar(cifrado: string): string {
  const [iv, tag, datos] = cifrado.split('.').map((p) => Buffer.from(p, 'base64url'));
  if (!iv || !tag || !datos) throw new Error('Dato cifrado inválido');
  const descifrador = createDecipheriv('aes-256-gcm', clave(), iv);
  descifrador.setAuthTag(tag);
  return Buffer.concat([descifrador.update(datos), descifrador.final()]).toString('utf8');
}
