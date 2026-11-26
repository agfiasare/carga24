import { formatearPesos } from '@carga24/shared';

/**
 * "5491155550001" → "+54 9 11 5555-0001". Como el código de área varía (11, 351, 2944…),
 * fuera de Buenos Aires se muestra "+54 9 3514445566" sin adivinar dónde cortar.
 */
export function formatearTelefono(telefono: string | null | undefined): string {
  if (!telefono) return '—';
  const amba = /^54911(\d{4})(\d{4})$/.exec(telefono);
  if (amba) return `+54 9 11 ${amba[1]}-${amba[2]}`;
  if (telefono.startsWith('549')) return `+54 9 ${telefono.slice(3)}`;
  return `+${telefono}`;
}

export function formatearFecha(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
}

/** Puntos básicos → texto de porcentaje: 250 → "2,5 %". */
export function formatearPorcentaje(pb: number): string {
  return `${(pb / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 })} %`;
}

/** "recién", "hace 5 min", "hace 2 h", o la fecha si es de otro día. */
export function formatearHace(iso: string, ahora = Date.now()): string {
  const minutos = Math.floor((ahora - new Date(iso).getTime()) / 60_000);
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} min`;
  if (minutos < 24 * 60) return `hace ${Math.floor(minutos / 60)} h`;
  return formatearFecha(iso);
}

export function formatearHora(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(iso));
}

/** "10.500,50" → 1050050 centavos. Devuelve null si no es un monto válido. */
export function leerPesos(texto: string): number | null {
  const limpio = texto.replace(/\s|\$/g, '').replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  return Math.round(Number(limpio) * 100);
}

/** Monto con signo explícito: +$ 1.350.000 / −$ 400.000. */
export function formatearConSigno(centavos: number): string {
  const signo = centavos > 0 ? '+' : centavos < 0 ? '−' : '';
  return `${signo}${formatearPesos(Math.abs(centavos))}`;
}

/** "5 h 40 min" desde un instante hasta ahora (o hasta `hasta`). */
export function formatearDuracion(desde: string, hasta: string | number = Date.now()): string {
  const fin = typeof hasta === 'number' ? hasta : new Date(hasta).getTime();
  const minutos = Math.max(0, Math.floor((fin - new Date(desde).getTime()) / 60_000));
  const horas = Math.floor(minutos / 60);
  return horas > 0 ? `${horas} h ${String(minutos % 60).padStart(2, '0')} min` : `${minutos} min`;
}
