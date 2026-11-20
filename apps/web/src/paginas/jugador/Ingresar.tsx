import { KeyRound, User } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { authJugador } from '../../api/auth';
import { useAccion } from '../../api/useAccion';
import { Aviso, Boton, CampoFormulario, PlantillaAcceso } from '../../componentes';
import { useSesionJugador } from '../../sesion/sesion';
import clases from '../formularios.module.css';

export function Ingresar() {
  const [identificador, setIdentificador] = useState('');
  const [contrasena, setContrasena] = useState('');
  const { establecer } = useSesionJugador();
  const navegar = useNavigate();
  const desde = (useLocation().state as { desde?: string } | null)?.desde ?? '/inicio';
  const { ejecutar, cargando, error } = useAccion(authJugador.ingresar);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const resultado = await ejecutar(identificador, contrasena);
    if (resultado) {
      const jugador = resultado.valor;
      establecer(jugador);
      navegar(jugador.debeCambiarContrasena ? '/cambiar-contrasena' : desde, { replace: true });
    }
  }

  return (
    <PlantillaAcceso
      titulo="Ingresar"
      bajada="Con tu teléfono o tu nombre de usuario."
      pie={
        <>
          ¿Primera vez? <Link to="/registro">Creá tu cuenta</Link>
          <br />
          ¿Te olvidaste la contraseña? Escribinos por WhatsApp y te damos una nueva.
        </>
      }
    >
      <form className={clases.formulario} onSubmit={enviar} noValidate>
        {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
        <CampoFormulario
          etiqueta="Teléfono o usuario"
          icono={<User size={18} />}
          autoComplete="username"
          value={identificador}
          onChange={(e) => setIdentificador(e.target.value)}
          required
        />
        <CampoFormulario
          etiqueta="Contraseña"
          type="password"
          icono={<KeyRound size={18} />}
          autoComplete="current-password"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          required
        />
        <Boton type="submit" tamano="lg" anchoCompleto cargando={cargando} disabled={!identificador || !contrasena}>
          Ingresar
        </Boton>
      </form>
    </PlantillaAcceso>
  );
}
