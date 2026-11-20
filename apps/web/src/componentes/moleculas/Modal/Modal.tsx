import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Boton } from '../../atomos/Boton/Boton';
import clases from './Modal.module.css';

export interface ModalProps {
  titulo: string;
  alCerrar: () => void;
  children: ReactNode;
  /** Botones del pie (por ejemplo Cancelar / Confirmar). */
  acciones?: ReactNode;
}

const ENFOCABLES = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Ventana modal accesible: se anuncia como diálogo, toma el foco al abrir,
 * lo mantiene adentro, se cierra con Escape y devuelve el foco al cerrar.
 * Se monta solo mientras está abierta: `{abierto && <Modal …/>}`.
 */
export function Modal({ titulo, alCerrar, children, acciones }: ModalProps) {
  const idTitulo = useId();
  const caja = useRef<HTMLDivElement>(null);
  const cerrar = useRef(alCerrar);
  cerrar.current = alCerrar;

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const elementos = () => Array.from(caja.current?.querySelectorAll<HTMLElement>(ENFOCABLES) ?? []);
    // Primero el contenido (un campo), si no el primer botón que no sea "cerrar".
    const inicial = elementos().find((e) => !e.dataset.cerrar) ?? elementos()[0];
    inicial?.focus();

    function teclado(evento: KeyboardEvent) {
      // Con un modal encima de otro, solo responde el de arriba.
      const abiertos = document.querySelectorAll('[aria-modal="true"]');
      if (abiertos[abiertos.length - 1] !== caja.current) return;
      if (evento.key === 'Escape') {
        evento.stopPropagation();
        cerrar.current();
      } else if (evento.key === 'Tab') {
        const lista = elementos();
        const primero = lista[0];
        const ultimo = lista[lista.length - 1];
        if (!primero || !ultimo) return;
        if (evento.shiftKey && document.activeElement === primero) {
          evento.preventDefault();
          ultimo.focus();
        } else if (!evento.shiftKey && document.activeElement === ultimo) {
          evento.preventDefault();
          primero.focus();
        }
      }
    }
    document.addEventListener('keydown', teclado);
    return () => {
      document.removeEventListener('keydown', teclado);
      anterior?.focus();
    };
  }, []);

  return (
    <div className={clases.fondo} onMouseDown={(e) => e.target === e.currentTarget && alCerrar()}>
      <div ref={caja} className={clases.caja} role="dialog" aria-modal="true" aria-labelledby={idTitulo}>
        <header className={clases.cabecera}>
          <h2 id={idTitulo} className={clases.titulo}>
            {titulo}
          </h2>
          <button type="button" className={clases.cerrar} onClick={alCerrar} aria-label="Cerrar" data-cerrar="true">
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className={clases.cuerpo}>{children}</div>
        {acciones ? <footer className={clases.pie}>{acciones}</footer> : null}
      </div>
    </div>
  );
}

export interface ModalConfirmacionProps {
  titulo: string;
  children: ReactNode;
  textoConfirmar: string;
  /** "peligro" para acciones como bloquear o borrar. */
  variante?: 'primario' | 'peligro';
  cargando?: boolean;
  /** Mientras falte completar algo, el botón de confirmar queda deshabilitado. */
  confirmarDeshabilitado?: boolean;
  alConfirmar: () => void;
  alCerrar: () => void;
}

/** Confirmación de una acción: cada acción importante del panel pasa por acá. */
export function ModalConfirmacion({ titulo, children, textoConfirmar, variante = 'primario', cargando, confirmarDeshabilitado, alConfirmar, alCerrar }: ModalConfirmacionProps) {
  return (
    <Modal
      titulo={titulo}
      alCerrar={alCerrar}
      acciones={
        <>
          <Boton variante="secundario" onClick={alCerrar} disabled={cargando}>
            Cancelar
          </Boton>
          <Boton variante={variante} onClick={alConfirmar} cargando={cargando} disabled={confirmarDeshabilitado}>
            {textoConfirmar}
          </Boton>
        </>
      }
    >
      {children}
    </Modal>
  );
}
