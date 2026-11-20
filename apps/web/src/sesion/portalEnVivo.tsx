import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { portal } from '../api/portal';

interface EstadoPortal {
  /** Avisos sin leer (para la campana). */
  noLeidas: number;
  /** Cambia cada vez que llega un aviso en vivo: las páginas lo usan para recargar. */
  version: number;
  actualizarAvisos: () => void;
}

const Contexto = createContext<EstadoPortal>({ noLeidas: 0, version: 0, actualizarAvisos: () => undefined });

/** Escucha los cambios de los pedidos propios y mantiene el contador de avisos. */
export function ProveedorPortalEnVivo({ children }: { children: ReactNode }) {
  const [noLeidas, setNoLeidas] = useState(0);
  const [version, setVersion] = useState(0);

  const actualizarAvisos = useCallback(() => {
    portal.avisos().then((a) => setNoLeidas(a.noLeidas), () => undefined);
  }, []);

  useEffect(() => {
    actualizarAvisos();
    if (typeof EventSource === 'undefined') return;
    const fuente = new EventSource('/api/v1/yo/eventos');
    fuente.addEventListener('pedido.actualizado', () => {
      setVersion((v) => v + 1);
      actualizarAvisos();
    });
    return () => fuente.close();
  }, [actualizarAvisos]);

  const valor = useMemo(() => ({ noLeidas, version, actualizarAvisos }), [noLeidas, version, actualizarAvisos]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const usePortalEnVivo = () => useContext(Contexto);
