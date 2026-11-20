import { Link } from 'react-router';
import { Aviso } from '../../componentes';
import { useSesionStaff } from '../../sesion/sesion';
import { PaginaPanel, useSecciones } from './PaginaPanel';
import clases from './panel.module.css';

const DESCRIPCIONES: Record<string, string> = {
  '/panel/jugadores': 'Buscar, crear y editar jugadores. Bloquear y resetear contraseñas.',
  '/panel/staff': 'Altas del equipo, perfiles asignados y permisos individuales.',
  '/panel/perfiles': 'Conjuntos de permisos para asignar de una vez.',
  '/panel/mi-cuenta': 'Cambiar tu contraseña.',
};

/** Inicio del panel. La cola de pedidos se suma en el Sprint 2. */
export function InicioPanel() {
  const { usuario } = useSesionStaff();
  const atajos = useSecciones().filter((s) => s.a !== '/panel');
  return (
    <PaginaPanel titulo={`Hola, ${usuario?.nombreVisible ?? usuario?.nombreUsuario ?? ''}`}>
      <Aviso tipo="info">La cola de pedidos llega en la próxima etapa. Mientras tanto, desde acá se administran jugadores, staff y permisos.</Aviso>
      <div className={clases.atajos}>
        {atajos.map((s) => (
          <Link key={s.a} to={s.a} className={clases.atajo}>
            <strong>
              <span aria-hidden="true">{s.icono}</span>
              {s.texto}
            </strong>
            <span>{DESCRIPCIONES[s.a]}</span>
          </Link>
        ))}
      </div>
    </PaginaPanel>
  );
}
