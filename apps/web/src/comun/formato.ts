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
