import clases from './LogoCargando.module.css';

export interface LogoCargandoProps {
  /** Alto del logo en píxeles. */
  tamano?: number;
  /** Texto para lectores de pantalla (y visible si `mostrarTexto`). */
  texto?: string;
  mostrarTexto?: boolean;
}

/** El logo girando como una ficha de casino mientras algo carga. */
export function LogoCargando({ tamano = 48, texto = 'Cargando…', mostrarTexto = false }: LogoCargandoProps) {
  return (
    <span className={clases.contenedor} role="status" aria-live="polite">
      <span className={clases.ficha} style={{ height: tamano }} aria-hidden="true">
        <img src="/marca/carga24-logo-oro.png" alt="" className={clases.logo} />
      </span>
      {mostrarTexto ? <span className={clases.texto}>{texto}</span> : <span className="visualmente-oculto">{texto}</span>}
    </span>
  );
}
