import { useEffect, useRef } from 'react';

export interface AvisoCola {
  tipo: 'pedido.creado' | 'pedido.actualizado';
  pedidoId: number;
  estado: string;
  actorId: string | null;
}

/**
 * Escucha la cola en vivo (Server-Sent Events). El navegador reconecta solo si se corta.
 * `alAvisar` se llama con cada pedido nuevo o cambiado.
 */
export function useColaEnVivo(alAvisar: (aviso: AvisoCola) => void, alReconectar?: () => void) {
  const avisar = useRef(alAvisar);
  const reconectar = useRef(alReconectar);
  avisar.current = alAvisar;
  reconectar.current = alReconectar;

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const fuente = new EventSource('/api/v1/pedidos/eventos');
    let caida = false;
    const escuchar = (evento: MessageEvent<string>) => {
      try {
        avisar.current(JSON.parse(evento.data) as AvisoCola);
      } catch {
        /* evento mal formado: se ignora */
      }
    };
    fuente.addEventListener('pedido.creado', escuchar);
    fuente.addEventListener('pedido.actualizado', escuchar);
    // Si se cortó y volvió, puede haberse perdido algo: se recarga todo.
    fuente.addEventListener('error', () => {
      caida = true;
    });
    fuente.addEventListener('open', () => {
      if (caida) reconectar.current?.();
      caida = false;
    });
    return () => fuente.close();
  }, []);
}

/** Un "ding" corto generado en el navegador (sin archivos de audio). */
export function sonarAviso(): void {
  try {
    const Contexto = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Contexto) return;
    const contexto = new Contexto();
    const oscilador = contexto.createOscillator();
    const volumen = contexto.createGain();
    oscilador.type = 'sine';
    oscilador.frequency.setValueAtTime(880, contexto.currentTime);
    oscilador.frequency.setValueAtTime(1320, contexto.currentTime + 0.12);
    volumen.gain.setValueAtTime(0.0001, contexto.currentTime);
    volumen.gain.exponentialRampToValueAtTime(0.25, contexto.currentTime + 0.02);
    volumen.gain.exponentialRampToValueAtTime(0.0001, contexto.currentTime + 0.4);
    oscilador.connect(volumen).connect(contexto.destination);
    oscilador.start();
    oscilador.stop(contexto.currentTime + 0.42);
    oscilador.onended = () => void contexto.close();
  } catch {
    /* sin audio disponible */
  }
}
