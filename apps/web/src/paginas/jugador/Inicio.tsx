import { LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { authJugador } from '../../api/auth';
import { Boton, PlantillaAcceso } from '../../componentes';
import { useSesionJugador } from '../../sesion/sesion';
import clases from '../formularios.module.css';

/** Inicio provisorio del jugador: sus datos. Los pedidos de carga y retiro llegan en el Sprint 2. */
export function Inicio() {
  const { usuario, establecer } = useSesionJugador();
  const navegar = useNavigate();
  if (!usuario) return null;

  async function salir() {
    await authJugador.salir().catch(() => undefined);
    establecer(null);
    navegar('/ingresar', { replace: true });
  }

  return (
    <PlantillaAcceso titulo={`Hola${usuario.nombreUsuario ? `, ${usuario.nombreUsuario}` : ''}`} bajada="Estos son los datos de tu cuenta.">
      <dl className={clases.datos}>
        <dt>Usuario en la plataforma</dt>
        <dd>{usuario.usuarioPlataforma ?? '—'}</dd>
        <dt>Teléfono</dt>
        <dd>{usuario.telefono ? `+${usuario.telefono}` : '—'}</dd>
        <dt>Nombre de usuario</dt>
        <dd>{usuario.nombreUsuario ?? '—'}</dd>
      </dl>
      <Link to="/cambiar-contrasena">Cambiar contraseña</Link>
      <Boton variante="secundario" icono={<LogOut size={18} aria-hidden="true" />} onClick={() => void salir()}>
        Salir
      </Boton>
    </PlantillaAcceso>
  );
}
