import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LogoCargando } from './LogoCargando';

describe('LogoCargando', () => {
  it('se anuncia como estado, con el texto oculto o visible', () => {
    const { rerender } = render(<LogoCargando />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
    rerender(<LogoCargando texto="Guardando…" mostrarTexto />);
    expect(screen.getByText('Guardando…')).toBeVisible();
  });
});
