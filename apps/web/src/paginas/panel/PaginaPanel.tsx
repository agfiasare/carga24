import type { Permiso } from '@carga24/shared';
import { BarChart3, FileClock, House, KeyRound, ListTodo, Megaphone, Settings, Shield, Ticket, UserCog, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { authStaff } from '../../api/auth';
import { Aviso, PlantillaPanel, type ItemMenu } from '../../componentes';
import { useSesionStaff } from '../../sesion/sesion';

/** Permisos efectivos de quien está en el panel. */
export function usePermisos() {
  const { usuario } = useSesionStaff();
  const permisos = new Set(usuario?.permisos ?? []);
  return {
    tiene: (permiso: Permiso) => permisos.has(permiso),
    algunoDe: (...lista: Permiso[]) => lista.some((p) => permisos.has(p)),
  };
}

const SECCIONES: (ItemMenu & { permisos?: Permiso[]; sinPermisos?: Permiso[] })[] = [
  // Quien ve pedidos arranca en la cola; el resto, en Inicio.
  { a: '/panel', texto: 'Inicio', icono: <House size={18} />, sinPermisos: ['pedidos.ver'] },
  { a: '/panel/cola', texto: 'Cola', icono: <ListTodo size={18} />, permisos: ['pedidos.ver'] },
  { a: '/panel/jugadores', texto: 'Jugadores', icono: <Users size={18} />, permisos: ['jugadores.ver'] },
  { a: '/panel/reportes', texto: 'Reportes', icono: <BarChart3 size={18} />, permisos: ['reportes.ver'] },
  { a: '/panel/promociones', texto: 'Promociones', icono: <Ticket size={18} />, permisos: ['promos.gestionar'] },
  { a: '/panel/novedades', texto: 'Novedades', icono: <Megaphone size={18} />, permisos: ['novedades.publicar'] },
  { a: '/panel/staff', texto: 'Staff', icono: <UserCog size={18} />, permisos: ['staff.gestionar'] },
  { a: '/panel/perfiles', texto: 'Perfiles', icono: <Shield size={18} />, permisos: ['perfiles.gestionar'] },
  { a: '/panel/configuracion', texto: 'Configuración', icono: <Settings size={18} />, permisos: ['configuracion.editar', 'plataformas.gestionar'] },
  { a: '/panel/auditoria', texto: 'Auditoría', icono: <FileClock size={18} />, permisos: ['auditoria.ver'] },
  { a: '/panel/mi-cuenta', texto: 'Mi cuenta', icono: <KeyRound size={18} /> },
];

/** El menú muestra solo lo que la persona puede usar (la API igual controla cada acción). */
export function useSecciones() {
  const { algunoDe } = usePermisos();
  return SECCIONES.filter((s) => (!s.permisos || algunoDe(...s.permisos)) && !(s.sinPermisos && algunoDe(...s.sinPermisos)));
}

export interface PaginaPanelProps {
  titulo: string;
  volver?: ReactNode;
  acciones?: ReactNode;
  /** Si se indica, hace falta alguno de estos permisos para ver la página. */
  requiere?: Permiso[];
  children: ReactNode;
}

export function PaginaPanel({ titulo, volver, acciones, requiere, children }: PaginaPanelProps) {
  const { usuario, establecer } = useSesionStaff();
  const { algunoDe } = usePermisos();
  const secciones = useSecciones();
  const navegar = useNavigate();
  if (!usuario) return null;

  async function salir() {
    await authStaff.salir().catch(() => undefined);
    establecer(null);
    navegar('/panel/ingresar', { replace: true });
  }

  const permitido = !requiere || algunoDe(...requiere);
  return (
    <PlantillaPanel
      menu={secciones}
      usuario={{ nombre: usuario.nombreVisible ?? usuario.nombreUsuario ?? '', perfil: usuario.perfil?.nombre }}
      alSalir={() => void salir()}
      titulo={permitido ? titulo : 'Sin acceso'}
      volver={volver}
      acciones={permitido ? acciones : undefined}
    >
      {permitido ? children : <Aviso tipo="info">No tenés permiso para ver esta sección. Si lo necesitás, pedíselo a quien administra el staff.</Aviso>}
    </PlantillaPanel>
  );
}
