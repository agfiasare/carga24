import { useEffect, useState } from 'react';
import { suscribirActividad } from '../api/actividad';
import { LogoCargando } from '../componentes';
import clases from './IndicadorPeticiones.module.css';

/** Pasado este tiempo sin respuesta, aparece el indicador (las peticiones rápidas no lo hacen titilar). */
export const DEMORA_INDICADOR_MS = 350;

/** Indicador global: el logo girando en una esquina mientras haya peticiones a la API en curso. */
export function IndicadorPeticiones() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let espera: ReturnType<typeof setTimeout> | undefined;
    const cancelar = suscribirActividad((pendientes) => {
      clearTimeout(espera);
      // Si ya se ve el logo grande de pantalla completa, el de la esquina sobra.
      const hayPantallaDeCarga = () => document.querySelector('[data-carga-pantalla-completa]') !== null;
      if (pendientes > 0) espera = setTimeout(() => setVisible(!hayPantallaDeCarga()), DEMORA_INDICADOR_MS);
      else setVisible(false);
    });
    return () => {
      clearTimeout(espera);
      cancelar();
    };
  }, []);

  if (!visible) return null;
  return (
    <div className={clases.indicador}>
      <LogoCargando tamano={30} mostrarTexto />
    </div>
  );
}
