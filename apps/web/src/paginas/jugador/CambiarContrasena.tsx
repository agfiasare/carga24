import { useNavigate } from 'react-router';
import { authJugador } from '../../api/auth';
import { PlantillaAcceso } from '../../componentes';
import { useSesionJugador } from '../../sesion/sesion';
import { CambioContrasena } from '../CambioContrasena';

export function CambiarContrasena() {
  const { usuario, recargar } = useSesionJugador();
  const navegar = useNavigate();
  const temporal = usuario?.debeCambiarContrasena ?? false;

  return (
    <PlantillaAcceso
      titulo="Cambiá tu contraseña"
      bajada={temporal ? 'Estás usando una contraseña temporal. Elegí una tuya para seguir.' : 'Al cambiarla se cierran tus otras sesiones.'}
    >
      <CambioContrasena
        guardar={authJugador.cambiarContrasena}
        alTerminar={() => {
          void recargar().then(() => navegar('/inicio', { replace: true }));
        }}
      />
    </PlantillaAcceso>
  );
}
