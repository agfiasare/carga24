import { useCallback, useEffect, useState } from 'react';
import { ErrorApi } from './cliente';

/**
 * Trae datos de la API al montar y cada vez que cambian las dependencias.
 * Si llegan respuestas fuera de orden (búsquedas rápidas), se queda con la última.
 */
export function useConsulta<T>(consultar: () => Promise<T>, dependencias: unknown[]) {
  const [datos, setDatos] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ErrorApi | null>(null);
  const [cargando, setCargando] = useState(true);
  const [version, setVersion] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const consulta = useCallback(consultar, dependencias);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    consulta()
      .then((d) => {
        if (!vigente) return;
        setDatos(d);
        setError(null);
      })
      .catch((e: unknown) => vigente && setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'Algo salió mal.')))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [consulta, version]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  return { datos, setDatos, error, cargando, recargar };
}
