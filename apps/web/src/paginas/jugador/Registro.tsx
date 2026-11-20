import { AtSign, Gamepad2, KeyRound, Phone } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { authJugador, type DatosRegistro } from '../../api/auth';
import { useAccion } from '../../api/useAccion';
import { Aviso, Boton, CampoFormulario, PlantillaAcceso } from '../../componentes';
import { useSesionJugador } from '../../sesion/sesion';
import clases from '../formularios.module.css';

const VACIO: DatosRegistro = { usuarioPlataforma: '', telefono: '', nombreUsuario: '', contrasena: '', mayorDeEdad: false };

export function Registro() {
  const [datos, setDatos] = useState(VACIO);
  const { establecer } = useSesionJugador();
  const navegar = useNavigate();
  const { ejecutar, cargando, error } = useAccion(authJugador.registrar);
  const cambiar = (campo: keyof DatosRegistro) => (e: { target: { value: string } }) => setDatos({ ...datos, [campo]: e.target.value });

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const resultado = await ejecutar(datos);
    if (resultado) {
      const jugador = resultado.valor;
      establecer(jugador);
      navegar('/inicio', { replace: true });
    }
  }

  // Si el error es de un campo, se muestra debajo de ese campo; si no, arriba.
  const errorGeneral = error && error.errores.length === 0 ? error.message : null;

  return (
    <PlantillaAcceso
      titulo="Creá tu cuenta"
      bajada="Solo te pedimos lo necesario para cargarte saldo. Sin datos personales."
      pie={
        <>
          ¿Ya tenés cuenta? <Link to="/ingresar">Ingresá</Link>
        </>
      }
    >
      <form className={clases.formulario} onSubmit={enviar} noValidate>
        {errorGeneral ? <Aviso tipo="error">{errorGeneral}</Aviso> : null}
        <CampoFormulario
          etiqueta="Tu usuario en la plataforma"
          ayuda="Con el que jugás: ahí te cargamos el saldo."
          icono={<Gamepad2 size={18} />}
          value={datos.usuarioPlataforma}
          onChange={cambiar('usuarioPlataforma')}
          error={error?.delCampo('usuarioPlataforma')}
          required
        />
        <CampoFormulario
          etiqueta="Teléfono"
          ayuda="Con código de área, sin 0 ni 15. Ej.: 11 5555 0001"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          icono={<Phone size={18} />}
          value={datos.telefono}
          onChange={cambiar('telefono')}
          error={error?.delCampo('telefono')}
          required
        />
        <CampoFormulario
          etiqueta="Nombre de usuario"
          ayuda="Para ingresar. Letras, números, punto o guion bajo."
          autoComplete="username"
          icono={<AtSign size={18} />}
          value={datos.nombreUsuario}
          onChange={cambiar('nombreUsuario')}
          error={error?.delCampo('nombreUsuario')}
          required
        />
        <CampoFormulario
          etiqueta="Contraseña"
          ayuda="Al menos 8 caracteres."
          type="password"
          autoComplete="new-password"
          icono={<KeyRound size={18} />}
          value={datos.contrasena}
          onChange={cambiar('contrasena')}
          error={error?.delCampo('contrasena')}
          required
        />
        <label className={clases.casilla}>
          <input type="checkbox" checked={datos.mayorDeEdad} onChange={(e) => setDatos({ ...datos, mayorDeEdad: e.target.checked })} />
          Confirmo que soy mayor de 18 años.
        </label>
        {error?.delCampo('mayorDeEdad') ? <span className={clases.error}>{error.delCampo('mayorDeEdad')}</span> : null}
        <Boton type="submit" tamano="lg" anchoCompleto cargando={cargando}>
          Crear cuenta
        </Boton>
      </form>
    </PlantillaAcceso>
  );
}
