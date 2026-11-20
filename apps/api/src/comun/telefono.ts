/**
 * Normaliza un teléfono argentino a solo dígitos con código de país, para que
 * "11 5555-0001", "+54 9 11 5555 0001" y "5491155550001" sean el mismo número.
 *
 * Reglas:
 * - Se quitan espacios, guiones, paréntesis y el "+".
 * - Si empieza con 0 (formato nacional), se quita el 0.
 * - 10 dígitos (código de área + número) → se antepone 549 (celular argentino).
 * - Si ya empieza con 54 se deja como está.
 * Devuelve null si no parece un teléfono válido.
 */
export function normalizarTelefono(entrada: string): string | null {
  let digitos = entrada.replace(/[\s\-()+.]/g, '');
  if (!/^\d+$/.test(digitos)) return null;
  if (digitos.startsWith('0')) digitos = digitos.slice(1);
  if (digitos.length === 10) digitos = `549${digitos}`;
  if (digitos.length < 10 || digitos.length > 15) return null;
  return digitos;
}

/** true si el texto parece un teléfono (para decidir si un identificador es teléfono o nombre de usuario). */
export function pareceTelefono(entrada: string): boolean {
  return /^[\d\s\-()+.]+$/.test(entrada.trim()) && entrada.replace(/\D/g, '').length >= 8;
}
