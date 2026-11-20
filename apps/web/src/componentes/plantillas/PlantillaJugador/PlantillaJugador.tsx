import { Bell, House, Landmark, Megaphone, ReceiptText } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import clases from './PlantillaJugador.module.css';

export interface PlantillaJugadorProps {
  titulo?: string;
  /** Enlace "volver" arriba del título. */
  volver?: { a: string; texto: string };
  noLeidas?: number;
  children: ReactNode;
}

const MENU = [
  { a: '/inicio', texto: 'Inicio', icono: House },
  { a: '/historial', texto: 'Pedidos', icono: ReceiptText },
  { a: '/cuentas', texto: 'Cuentas', icono: Landmark },
  { a: '/novedades', texto: 'Novedades', icono: Megaphone },
];

/** App del jugador: barra con logo y avisos arriba, menú abajo (como una app de celular). */
export function PlantillaJugador({ titulo, volver, noLeidas = 0, children }: PlantillaJugadorProps) {
  return (
    <div className={clases.app}>
      <header className={clases.barra}>
        <Link to="/inicio" className={clases.marca} aria-label="Carga24, inicio">
          <img src="/marca/carga24-logo-oro.png" alt="" className={clases.logo} />
          <span>Carga24</span>
        </Link>
        <Link to="/avisos" className={clases.campana} aria-label={noLeidas > 0 ? `Avisos, ${noLeidas} sin leer` : 'Avisos'}>
          <Bell size={22} aria-hidden="true" />
          {noLeidas > 0 ? <span className={clases.globo}>{noLeidas > 9 ? '9+' : noLeidas}</span> : null}
        </Link>
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
