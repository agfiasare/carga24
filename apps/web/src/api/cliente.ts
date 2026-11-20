/** Error de la API con el formato { mensaje, codigo?, errores? }. */
export class ErrorApi extends Error {
  constructor(
    readonly status: number,
    mensaje: string,
    readonly codigo?: string,
    readonly errores: { campo: string; mensaje: string }[] = [],
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }

  /** Error de un campo puntual, para mostrarlo debajo del campo. */
  delCampo(campo: string): string | undefined {
    return this.errores.find((e) => e.campo === campo)?.mensaje;
  }
}

/**
 * Llama a la API en el mismo dominio (/api/v1/...). La sesión viaja en una cookie
 * httpOnly que pone el servidor: el frontend nunca ve ni guarda el token.
 */
export async function api<T>(metodo: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', ruta: string, cuerpo?: unknown): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`/api/v1${ruta}`, {
      method: metodo,
      credentials: 'same-origin',
      headers: cuerpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi(0, 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.');
  }
  if (respuesta.status === 204) return undefined as T;
  const datos: unknown = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const error = (datos ?? {}) as { mensaje?: string; codigo?: string; errores?: { campo: string; mensaje: string }[] };
    throw new ErrorApi(respuesta.status, error.mensaje ?? 'Algo salió mal. Probá de nuevo.', error.codigo, error.errores);
  }
  return datos as T;
}
