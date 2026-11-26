import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import clases from './PlantillaPanel.module.css';

export interface ItemMenu {
  a: string;
  texto: string;
  icono: ReactNode;
}

export interface PlantillaPanelProps {
  menu: ItemMenu[];
  usuario: { nombre: string; perfil?: string };
  alSalir: () => void;
  titulo: string;
  /** Texto chico arriba del título (por ejemplo "Jugadores" en el detalle). */
  volver?: ReactNode;
  /** Botones a la derecha del título. */
  acciones?: ReactNode;
  /** Barra fija arriba del contenido en todas las páginas (hora, turno). */
  barraSuperior?: ReactNode;
  children: ReactNode;
}

/** Estructura del panel del staff: menú (lateral en escritorio, arriba en el celular) y contenido. */
export function PlantillaPanel({ menu, usuario, alSalir, titulo, volver, acciones, barraSuperior, children }: PlantillaPanelProps) {
  return (
    <div className={clases.panel} data-tema="staff">
      <aside className={clases.lateral}>
        <div className={clases.marca}>
          <img src="/marca/carga24-logo-oro.png" alt="" className={clases.logo} />
          <span>
            Carga24 <small>Panel</small>
          </span>
        </div>
        <nav aria-label="Secciones del panel" className={clases.menu}>
          {menu.map((item) => (
            <NavLink key={item.a} to={item.a} end={item.a === '/panel'} className={({ isActive }) => `${clases.item} ${isActive ? clases.activo : ''}`}>
              <span aria-hidden="true" className={clases.icono}>
                {item.icono}
              </span>
              {item.texto}
            </NavLink>
          ))}
        </nav>
        <div className={clases.usuario}>
          <span className={clases.nombre}>
            {usuario.nombre}
            {usuario.perfil ? <small>{usuario.perfil}</small> : null}
          </span>
          <button type="button" className={clases.salir} onClick={alSalir}>
            <LogOut size={18} aria-hidden="true" />
            Salir
          </button>
        </div>
      </aside>
      <main className={clases.contenido}>
        {barraSuperior ? <div className={clases.barraSuperior}>{barraSuperior}</div> : null}
        <header className={clases.cabecera}>
          <div>
            {volver ? <div className={clases.volver}>{volver}</div> : null}
            <h1 className={clases.titulo}>{titulo}</h1>
          </div>
          {acciones ? <div className={clases.acciones}>{acciones}</div> : null}
        </header>
        {children}
      </main>
    </div>
  );
}
