import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router';
import { authStaff } from '../../api/auth';
import { Boton, PlantillaAcceso } from '../../componentes';
import { useSesionStaff } from '../../sesion/sesion';
import clases from '../formularios.module.css';

/** Inicio provisorio del panel: quién ingresó y qué permisos tiene. La cola de pedidos llega en el Sprint 2. */
export function InicioPanel() {
  const { usuario, establecer } = useSesionStaff();
  const navegar = useNavigate();
  if (!usuario) return null;

  async function salir() {
    await authStaff.salir().catch(() => undefined);
    establecer(null);
    navegar('/panel/ingresar', { replace: true });
  }

  return (
    <PlantillaAcceso marca="Panel del staff" titulo={`Hola, ${usuario.nombreVisible ?? usuario.nombreUsuario ?? ''}`} bajada={`Perfil: ${usuario.perfil?.nombre ?? 'sin perfil'}`}>
      <h2 className={clases.subtitulo}>Tus permisos ({usuario.permisos.length})</h2>
      <ul className={clases.permisos}>
        {usuario.permisos.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <Boton variante="secundario" icono={<LogOut size={18} aria-hidden="true" />} onClick={() => void salir()}>
        Salir
      </Boton>
    </PlantillaAcceso>
  );
}
