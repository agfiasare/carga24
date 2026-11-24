import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seguirPeticion } from '../api/actividad';
import { DEMORA_INDICADOR_MS, IndicadorPeticiones } from './IndicadorPeticiones';

describe('IndicadorPeticiones', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('aparece solo si la petición tarda, y se va al terminar', async () => {
    render(<IndicadorPeticiones />);
    let resolver!: () => void;
    let peticion!: Promise<void>;
    act(() => {
      peticion = seguirPeticion(new Promise<void>((r) => (resolver = r)));
    });
    act(() => vi.advanceTimersByTime(DEMORA_INDICADOR_MS - 50));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
    await act(async () => {
      resolver();
      await peticion;
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('no se duplica con la pantalla de carga completa', () => {
    render(
      <>
        <div data-carga-pantalla-completa="" />
        <IndicadorPeticiones />
      </>,
    );
    act(() => {
      void seguirPeticion(new Promise<void>(() => undefined));
    });
    act(() => vi.advanceTimersByTime(DEMORA_INDICADOR_MS * 2));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('una petición rápida no lo muestra', async () => {
    render(<IndicadorPeticiones />);
    await act(async () => {
      await seguirPeticion(Promise.resolve());
    });
    act(() => vi.advanceTimersByTime(DEMORA_INDICADOR_MS * 2));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
