import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampoFormulario } from './CampoFormulario';

describe('CampoFormulario', () => {
  it('conecta la etiqueta con el campo', () => {
    render(<CampoFormulario etiqueta="Nombre de usuario" />);
    expect(screen.getByLabelText('Nombre de usuario')).toBeInTheDocument();
  });

  it('marca el error y lo asocia al campo', () => {
    render(<CampoFormulario etiqueta="Teléfono" error="Ese teléfono ya tiene una cuenta" />);
    const campo = screen.getByLabelText('Teléfono');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription('Ese teléfono ya tiene una cuenta');
  });
});
