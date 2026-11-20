import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Boton } from '../../atomos/Boton/Boton';
import { Modal } from '../Modal/Modal';
import clases from './ContrasenaTemporal.module.css';

export interface ContrasenaTemporalProps {
  /** Para quién es: "juanp", "Laura". */
  para: string;
  contrasena: string;
  alCerrar: () => void;
}

/** Muestra una contraseña temporal UNA sola vez, con botón para copiarla. */
export function ContrasenaTemporal({ para, contrasena, alCerrar }: ContrasenaTemporalProps) {
  const [copiada, setCopiada] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(contrasena);
      setCopiada(true);
    } catch {
      setCopiada(false);
    }
  }

  return (
    <Modal
      titulo="Contraseña temporal"
      alCerrar={alCerrar}
      acciones={<Boton onClick={alCerrar}>Listo, ya la pasé</Boton>}
    >
      <p>
        Pasale esta contraseña a <strong>{para}</strong>. Al ingresar va a tener que elegir una propia.
      </p>
      <div className={clases.caja}>
        <code className={clases.contrasena}>{contrasena}</code>
        <Boton variante="secundario" onClick={() => void copiar()} icono={copiada ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}>
          {copiada ? 'Copiada' : 'Copiar'}
        </Boton>
      </div>
      <p className={clases.nota}>No se vuelve a mostrar. Si se pierde, se genera otra.</p>
    </Modal>
  );
}
