import { ChevronsLeft, ChevronsRight, LogOut } from 'lucide-react';
import { useState, type ReactNode } from 'react';
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
const CLAVE_ENCOGIDO = 'carga24.panel.menuEncogido';

function leerEncogido(): boolean {
  try {
    return localStorage.getItem(CLAVE_ENCOGIDO) === 'si';
  } catch {
    return false;
  }
}

export function PlantillaPanel({ menu, usuario, alSalir, titulo, volver, acciones, barraSuperior, children }: PlantillaPanelProps) {
  // El menú lateral se puede encoger a solo íconos; se recuerda en este navegador.
  const [encogido, setEncogido] = useState(leerEncogido);
  function alternar() {
    const nuevo = !encogido;
    setEncogido(nuevo);
    try {
      localStorage.setItem(CLAVE_ENCOGIDO, nuevo ? 'si' : 'no');
    } catch {
      /* sin almacenamiento: vale solo para esta visita */
    }
  }

  return (
    <div className={`${clases.panel} ${encogido ? clases.encogido : ''}`} data-tema="staff">
      <aside className={clases.lateral}>
        <div className={clases.marca}>
          <img src="/marca/carga24-logo-oro.png" alt="" className={clases.logo} />
          <span className={clases.texto}>
            Carga24 <small>Panel</small>
          </span>
            <button type="button" className={clases.encoger} onClick={alternar} aria-expanded={!encogido} aria-label={encogido ? 'Mostrar el menú completo' : 'Encoger el menú'} title={encogido ? 'Mostrar el menú completo' : 'Encoger el menú'}>
              {encogido ? <ChevronsRight size={18} aria-hidden="true" /> : <ChevronsLeft size={18} aria-hidden="true" />}
            </button>
        </div>
        <nav aria-label="Secciones del panel" className={clases.menu}>
          {menu.map((item) => (
            <NavLink
              key={item.a}
              to={item.a}
              end={item.a === '/panel'}
              title={encogido ? item.texto : undefined}
              className={({ isActive }) => `${clases.item} ${isActive ? clases.activo : ''}`}
            >
              <span aria-hidden="true" className={clases.icono}>
                {item.icono}
              </span>
              <span className={clases.texto}>{item.texto}</span>
            </NavLink>
          ))}
        </nav>
        <div className={clases.usuario}>
          <span className={`${clases.nombre} ${clases.texto}`}>
            {usuario.nombre}
            {usuario.perfil ? <small>{usuario.perfil}</small> : null}
          </span>
          <button type="button" className={clases.salir} onClick={alSalir} aria-label={encogido ? 'Salir' : undefined} title={encogido ? 'Salir' : undefined}>
            <LogOut size={18} aria-hidden="true" />
            <span className={clases.texto}>Salir</span>
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
