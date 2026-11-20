import type { ReactNode } from 'react';
import clases from './PlantillaAcceso.module.css';

export interface PlantillaAccesoProps {
  titulo: string;
  bajada?: ReactNode;
  /** Etiqueta chica arriba del título, por ejemplo "Panel del staff". */
  marca?: string;
  pie?: ReactNode;
  children: ReactNode;
}

/** Pantallas de ingreso, registro y cambio de contraseña: logo, título y una tarjeta. */
export function PlantillaAcceso({ titulo, bajada, marca, pie, children }: PlantillaAccesoProps) {
  return (
    <main className={clases.pagina}>
      <img src="/marca/carga24-logo-oro.png" alt="Carga24" className={clases.logo} />
      <section className={clases.tarjeta} aria-labelledby="titulo-acceso">
        {marca ? <span className={clases.marca}>{marca}</span> : null}
        <h1 id="titulo-acceso" className={clases.titulo}>
          {titulo}
        </h1>
        {bajada ? <p className={clases.bajada}>{bajada}</p> : null}
        {children}
      </section>
      {pie ? <div className={clases.pie}>{pie}</div> : null}
    </main>
  );
}
