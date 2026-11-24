import { Bell, ChevronDown, House, KeyRound, Landmark, LogOut, Megaphone, ReceiptText, UserRound } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import clases from './PlantillaJugador.module.css';

export interface PlantillaJugadorProps {
  titulo?: string;
  /** Enlace "volver" arriba del título. */
  volver?: { a: string; texto: string };
  noLeidas?: number;
  /** Menú de la cuenta (arriba a la derecha): nombre y salir. */
  cuenta?: { nombre: string; alSalir: () => void };
  children: ReactNode;
}

const MENU = [
  { a: '/inicio', texto: 'Inicio', icono: House },
  { a: '/historial', texto: 'Pedidos', icono: ReceiptText },
  { a: '/cuentas', texto: 'Cuentas', icono: Landmark },
  { a: '/novedades', texto: 'Novedades', icono: Megaphone },
];

/** App del jugador: barra con logo y avisos arriba, menú abajo (como una app de celular). */
export function PlantillaJugador({ titulo, volver, noLeidas = 0, cuenta, children }: PlantillaJugadorProps) {
  return (
    <div className={clases.app}>
      <header className={clases.barra}>
        <Link to="/inicio" className={clases.marca} aria-label="Carga24, inicio">
          <img src="/marca/carga24-logo-oro.png" alt="" className={clases.logo} />
          <span>Carga24</span>
        </Link>
        <div className={clases.herramientas}>
          <Link to="/avisos" className={clases.campana} aria-label={noLeidas > 0 ? `Avisos, ${noLeidas} sin leer` : 'Avisos'}>
            <Bell size={22} aria-hidden="true" />
            {noLeidas > 0 ? <span className={clases.globo}>{noLeidas > 9 ? '9+' : noLeidas}</span> : null}
          </Link>
          {cuenta ? <MenuCuenta {...cuenta} /> : null}
        </div>
      </header>
      <main className={clases.contenido}>
        {volver ? (
          <Link to={volver.a} className={clases.volver}>
            ← {volver.texto}
          </Link>
        ) : null}
        {titulo ? <h1 className={clases.titulo}>{titulo}</h1> : null}
        {children}
      </main>
      <nav className={clases.menu} aria-label="Secciones">
        {MENU.map(({ a, texto, icono: Icono }) => (
          <NavLink key={a} to={a} className={({ isActive }) => `${clases.item} ${isActive ? clases.activo : ''}`}>
            <Icono size={22} aria-hidden="true" />
            {texto}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** Botón con el nombre que despliega "Cambiar contraseña" y "Salir". Se cierra con Escape o al tocar afuera. */
function MenuCuenta({ nombre, alSalir }: { nombre: string; alSalir: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const id = useId();
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    const teclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbierto(false);
        boton.current?.focus();
      }
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', teclado);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', teclado);
    };
  }, [abierto]);

  return (
    <div ref={contenedor} className={clases.cuenta}>
      <button
        ref={boton}
        type="button"
        className={clases.botonCuenta}
        aria-expanded={abierto}
        aria-controls={id}
        aria-label={`Tu cuenta: ${nombre}`}
        onClick={() => setAbierto(!abierto)}
      >
        <UserRound size={20} aria-hidden="true" />
        <span className={clases.nombreCuenta}>{nombre}</span>
        <ChevronDown size={16} aria-hidden="true" className={abierto ? clases.girado : undefined} />
      </button>
      {abierto ? (
        <div id={id} className={clases.desplegable}>
          <span className={clases.desplegableNombre}>{nombre}</span>
          <Link to="/cambiar-contrasena" className={clases.opcion} onClick={() => setAbierto(false)}>
            <KeyRound size={18} aria-hidden="true" />
            Cambiar contraseña
          </Link>
          <button
            type="button"
            className={clases.opcion}
            onClick={() => {
              setAbierto(false);
              alSalir();
            }}
          >
            <LogOut size={18} aria-hidden="true" />
            Salir
          </button>
        </div>
      ) : null}
    </div>
  );
}
