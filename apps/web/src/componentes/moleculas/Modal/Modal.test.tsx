import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ModalConfirmacion } from './Modal';

describe('ModalConfirmacion', () => {
  it('es un diálogo con título, toma el foco y confirma', async () => {
    const alConfirmar = vi.fn();
    render(
      <ModalConfirmacion titulo="Bloquear" textoConfirmar="Sí, bloquear" alConfirmar={alConfirmar} alCerrar={() => undefined}>
        <p>Seguro?</p>
      </ModalConfirmacion>,
    );
    expect(screen.getByRole('dialog', { name: 'Bloquear' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Sí, bloquear' }));
    expect(alConfirmar).toHaveBeenCalledOnce();
  });

  it('se cierra con Escape y mantiene el foco adentro', async () => {
    const alCerrar = vi.fn();
    render(
      <ModalConfirmacion titulo="Bloquear" textoConfirmar="Bloquear" alConfirmar={() => undefined} alCerrar={alCerrar}>
        <p>Seguro?</p>
      </ModalConfirmacion>,
    );
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(alCerrar).toHaveBeenCalledOnce();
  });
});
