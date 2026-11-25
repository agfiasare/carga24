import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { authJugador, authStaff, type Jugador, type StaffYo } from '../api/auth';
import { ErrorApi } from '../api/cliente';
import { LogoCargando } from '../componentes';
import clases from './sesion.module.css';

interface EstadoSesion<T> {
  /** undefined: todavía consultando; null: sin sesión. */
  usuario: T | null | undefined;
  establecer: (usuario: T | null) => void;
  recargar: () => Promise<void>;
}

function crearSesion<T>(consultar: () => Promise<T>) {
  const Contexto = createContext<EstadoSesion<T> | null>(null);

  function Proveedor({ children }: { children: ReactNode }) {
    const [usuario, setUsuario] = useState<T | null | undefined>(undefined);
    const recargar = useCallback(async () => {
      try {
        setUsuario(await consultar());
      } catch (e) {
        // 401/403: no hay sesión. Otros errores: también la tratamos como cerrada.
        if (!(e instanceof ErrorApi)) console.error(e);
        setUsuario(null);
      }
    }, []);
    useEffect(() => {
      void recargar();
    }, [recargar]);
    const valor = useMemo(() => ({ usuario, establecer: setUsuario, recargar }), [usuario, recargar]);
    return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
  }

  function useSesion(): EstadoSesion<T> {
    const valor = useContext(Contexto);
    if (!valor) throw new Error('Falta el proveedor de sesión');
    return valor;
  }

  return { Proveedor, useSesion };
}

const jugador = crearSesion<Jugador>(authJugador.yo);
export const ProveedorSesionJugador = jugador.Proveedor;
export const useSesionJugador = jugador.useSesion;

const staff = crearSesion<StaffYo>(authStaff.yo);
export const ProveedorSesionStaff = staff.Proveedor;
export const useSesionStaff = staff.useSesion;

function Cargando() {
  return (
    <div className={clases.cargando} data-carga-pantalla-completa="">
      <LogoCargando tamano={88} />
    </div>
  );
}

/** Rutas del jugador: sin sesión va a /ingresar; con contraseña temporal, a cambiarla. */
export function RutaJugador() {
  const { usuario } = useSesionJugador();
  const { pathname } = useLocation();
  if (usuario === undefined) return <Cargando />;
  if (usuario === null) return <Navigate to="/ingresar" replace state={{ desde: pathname }} />;
  if (usuario.debeCambiarContrasena && pathname !== '/cambiar-contrasena') return <Navigate to="/cambiar-contrasena" replace />;
  return <Outlet />;
}

/** Rutas del panel: hace falta la sesión completa (contraseña + 2FA). */
export function RutaStaff() {
  const { usuario } = useSesionStaff();
  if (usuario === undefined) return <Cargando />;
  if (usuario === null) return <Navigate to="/panel/ingresar" replace />;
  return <Outlet />;
}
