/**
 * Cuántas peticiones a la API están en curso, para mostrar el indicador de carga.
 * Lo usan el cliente de la API y los envíos con archivo; la cola en vivo (eventos) no cuenta.
 */
type Oyente = (pendientes: number) => void;

let pendientes = 0;
const oyentes = new Set<Oyente>();

function avisar(): void {
  for (const oyente of oyentes) oyente(pendientes);
}

/** Envuelve una petición: suma mientras dura y resta al terminar (salga bien o mal). */
export async function seguirPeticion<T>(peticion: Promise<T>): Promise<T> {
  pendientes++;
  avisar();
  try {
    return await peticion;
  } finally {
    pendientes--;
    avisar();
  }
}

export function suscribirActividad(oyente: Oyente): () => void {
  oyentes.add(oyente);
  oyente(pendientes);
  return () => oyentes.delete(oyente);
}
