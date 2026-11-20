import { useCallback, useState } from 'react';
import { ErrorApi } from './cliente';

/**
 * Estado de un envío a la API: cargando y error. `ejecutar` devuelve { valor } si salió bien
 * o null si falló (el error queda en `error` para mostrarlo).
 */
export function useAccion<A extends unknown[], R>(accion: (...args: A) => Promise<R>) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<ErrorApi | null>(null);

  const ejecutar = useCallback(
    async (...args: A): Promise<{ valor: R } | null> => {
      setCargando(true);
      setError(null);
      try {
        return { valor: await accion(...args) };
      } catch (e) {
        setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'Algo salió mal. Probá de nuevo.'));
        return null;
      } finally {
        setCargando(false);
      }
    },
    [accion],
  );

  return { ejecutar, cargando, error };
}
