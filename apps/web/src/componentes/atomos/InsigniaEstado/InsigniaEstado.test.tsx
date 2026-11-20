import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InsigniaEstado, textoEstado } from './InsigniaEstado';

describe('InsigniaEstado', () => {
  it('muestra el texto del estado', () => {
    render(<InsigniaEstado estado="acreditado" />);
    expect(screen.getByText('Acreditada')).toBeInTheDocument();
  });

  it('ajusta el género según el tipo de pedido', () => {
    expect(textoEstado('verificado', 'carga')).toBe('Verificada');
    expect(textoEstado('verificado', 'retiro')).toBe('Verificado');
  });
});
