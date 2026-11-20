import { Link, Navigate } from 'react-router';
import { useSesionStaff } from '../../sesion/sesion';
import { PaginaPanel, usePermisos, useSecciones } from './PaginaPanel';
import clases from './panel.module.css';

const DESCRIPCIONES: Record<string, string> = {
  '/panel/jugadores': 'Buscar, crear y editar jugadores. Bloquear y resetear contraseñas.',
  '/panel/reportes': 'Ganancia y movimientos por período. Exportar a Excel.',
  '/panel/configuracion': 'Comisión, montos, datos de pago y plataformas.',
  '/panel/auditoria': 'Quién hizo qué y cuándo.',
  '/panel/promociones': 'Cupones con código, vigencia y dónde se muestran.',
  '/panel/novedades': 'Publicar avisos y novedades para los jugadores.',
  '/panel/staff': 'Altas del equipo, perfiles asignados y permisos individuales.',
  '/panel/perfiles': 'Conjuntos de permisos para asignar de una vez.',
  '/panel/mi-cuenta': 'Cambiar tu contraseña.',
};

/** Inicio del panel. La cola de pedidos se suma en el Sprint 2. */
export function InicioPanel() {
  const { usuario } = useSesionStaff();
  const atajos = useSecciones().filter((s) => s.a !== '/panel');
  const { tiene } = usePermisos();
  if (tiene('pedidos.ver')) return <Navigate to="/panel/cola" replace />;
  return (
    <PaginaPanel titulo={`Hola, ${usuario?.nombreVisible ?? usuario?.nombreUsuario ?? ''}`}>
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
