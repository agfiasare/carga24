import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { caja, type TurnoActual } from '../../../api/caja';
import { useConsulta } from '../../../api/useConsulta';
import { useSesionStaff } from '../../../sesion/sesion';

interface ContextoTurno {
  estado: TurnoActual | undefined;
  recargar: () => void;
  /** Puede tomar, verificar, acreditar o pagar: tiene turno abierto o no lo necesita. */
  puedeOperar: boolean;
}

const Contexto = createContext<ContextoTurno | null>(null);

/**
 * El turno de quien está en el panel, para la barra de arriba y la cola. Solo lo mueve
 * lo que hace la propia persona: se recarga al operar en la cola (ella llama a `recargar`)
 * y al cambiar de página.
 */
export function ProveedorTurno({ children }: { children: ReactNode }) {
  const { usuario } = useSesionStaff();
  const { pathname } = useLocation();
  const { datos, recargar } = useConsulta(caja.turnoActual, [usuario?.id]);
  useEffect(() => {
    recargar();
  }, [pathname, recargar]);
  const puedeOperar = Boolean(datos && (datos.turno || !datos.requiereTurno));
  return <Contexto.Provider value={{ estado: datos, recargar, puedeOperar }}>{children}</Contexto.Provider>;
}

/** null fuera del proveedor (por ejemplo, en una prueba de una página suelta). */
export function useTurno(): ContextoTurno | null {
  return useContext(Contexto);
}
