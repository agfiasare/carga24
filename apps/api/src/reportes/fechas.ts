/**
 * Fechas del negocio: los días son los de Argentina (UTC−3, sin horario de verano).
 * "desde" y "hasta" (AAAA-MM-DD) son inclusivos.
 */
export function inicioDeFecha(fecha: string): Date {
  return new Date(`${fecha}T00:00:00-03:00`);
}

export function rangoDeFechas(desde?: string, hasta?: string): { gte?: Date; lt?: Date } | null {
  if (!desde && !hasta) return null;
  return {
    ...(desde ? { gte: inicioDeFecha(desde) } : {}),
    ...(hasta ? { lt: new Date(inicioDeFecha(hasta).getTime() + 24 * 60 * 60 * 1000) } : {}),
  };
}

/** Fecha de Argentina (AAAA-MM-DD) de un instante. */
export function fechaArgentina(momento: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(momento);
}
