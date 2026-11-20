import { vi } from 'vitest';

export function respuesta(status: number, cuerpo?: unknown): Response {
  return new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
}

type Respuesta = Response | ((cuerpo: unknown) => Response);

/**
 * fetch falso que responde según "MÉTODO /ruta" (sin /api/v1), como haría la API.
 * Guarda cada llamada en `llamadas` para revisar qué se envió.
 */
export function apiFalsa(rutas: Record<string, Respuesta>) {
  const llamadas: { clave: string; cuerpo: unknown }[] = [];
  const fetch = vi.fn((url: string, opciones?: RequestInit) => {
    const clave = `${opciones?.method ?? 'GET'} ${url.replace('/api/v1', '')}`;
    const cuerpo: unknown =
      opciones?.body instanceof FormData
        ? Object.fromEntries([...opciones.body.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : `archivo:${v.name}`]))
        : opciones?.body
          ? JSON.parse(String(opciones.body))
          : undefined;
    llamadas.push({ clave, cuerpo });
    const r = rutas[clave];
    if (!r) return Promise.resolve(respuesta(404, { mensaje: `sin ruta ${clave}` }));
    return Promise.resolve(typeof r === 'function' ? r(cuerpo) : r.clone());
  });
  vi.stubGlobal('fetch', fetch);
  return { fetch, llamadas, enviado: (clave: string) => llamadas.filter((l) => l.clave === clave).map((l) => l.cuerpo) };
}
