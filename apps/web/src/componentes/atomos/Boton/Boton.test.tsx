import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Boton } from './Boton';

describe('Boton', () => {
  it('es un botón accesible que no envía formularios por defecto', () => {
    render(<Boton>Pedir carga</Boton>);
    const boton = screen.getByRole('button', { name: 'Pedir carga' });
    expect(boton).toHaveAttribute('type', 'button');
  });

  it('llama a onClick al tocarlo', async () => {
    const alTocar = vi.fn();
    render(<Boton onClick={alTocar}>Tomar pedido</Boton>);
    await userEvent.click(screen.getByRole('button'));
    expect(alTocar).toHaveBeenCalledOnce();
  });

  it('mientras carga queda bloqueado y lo anuncia', async () => {
    const alTocar = vi.fn();
    render(
      <Boton cargando onClick={alTocar}>
        Enviando
      </Boton>,
    );
    const boton = screen.getByRole('button');
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(boton);
    expect(alTocar).not.toHaveBeenCalled();
  });
});
