import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Aviso } from './Aviso';

describe('Aviso', () => {
  it('anuncia los errores como alerta', () => {
    render(<Aviso tipo="error">Falló</Aviso>);
    expect(screen.getByRole('alert')).toHaveTextContent('Falló');
  });

  it('los demás avisos son de estado', () => {
    render(<Aviso tipo="ok">Listo</Aviso>);
    expect(screen.getByRole('status')).toHaveTextContent('Listo');
  });
});
