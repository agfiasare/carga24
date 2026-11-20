import { KeyRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAccion } from '../api/useAccion';
import { Aviso, Boton, CampoFormulario } from '../componentes';
import clases from './formularios.module.css';

export interface CambioContrasenaProps {
  /** Si es false, no se pide la contraseña actual (staff con la temporal recién validada). */
  pedirActual?: boolean;
  textoBoton?: string;
  guardar: (actual: string, nueva: string) => Promise<unknown>;
  alTerminar: () => void;
}

/** Formulario de contraseña nueva (con repetición), compartido por jugador y staff. */
export function CambioContrasena({ pedirActual = true, textoBoton = 'Guardar contraseña', guardar, alTerminar }: CambioContrasenaProps) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [noCoinciden, setNoCoinciden] = useState(false);
  const { ejecutar, cargando, error } = useAccion(guardar);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (nueva !== repetida) {
      setNoCoinciden(true);
      return;
    }
    setNoCoinciden(false);
    if (await ejecutar(actual, nueva)) alTerminar();
  }

  return (
    <form
      className={clases.formulario}
      onSubmit={(e) => void enviar(e)}
      noValidate
    >
      {error && error.errores.length === 0 ? <Aviso tipo="error">{error.message}</Aviso> : null}
      {pedirActual ? (
        <CampoFormulario
          etiqueta="Contraseña actual"
          ayuda="Si te dimos una temporal, es esa."
          type="password"
          autoComplete="current-password"
          icono={<KeyRound size={18} />}
          value={actual}
          onChange={(e) => setActual(e.target.value)}
        />
      ) : null}
      <CampoFormulario
        etiqueta="Contraseña nueva"
        ayuda="Al menos 8 caracteres."
        type="password"
        autoComplete="new-password"
        icono={<KeyRound size={18} />}
        value={nueva}
        onChange={(e) => setNueva(e.target.value)}
        error={error?.delCampo('nueva')}
      />
      <CampoFormulario
        etiqueta="Repetí la contraseña nueva"
        type="password"
        autoComplete="new-password"
        icono={<KeyRound size={18} />}
        value={repetida}
        onChange={(e) => setRepetida(e.target.value)}
        error={noCoinciden ? 'Las contraseñas no coinciden' : undefined}
      />
      <Boton type="submit" tamano="lg" anchoCompleto cargando={cargando} disabled={!nueva || !repetida || (pedirActual && !actual)}>
        {textoBoton}
      </Boton>
    </form>
  );
}
