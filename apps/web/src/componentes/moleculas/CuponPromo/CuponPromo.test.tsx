import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CuponPromo } from './CuponPromo';

describe('CuponPromo', () => {
  it('muestra el beneficio y el código, y se anuncia completo', () => {
    render(<CuponPromo titulo="Finde 10% extra" condiciones="De viernes a domingo" codigo="FINDE10" vigencia="Hasta el 22/11" />);
    expect(screen.getByRole('article', { name: 'Promo Finde 10% extra, código FINDE10' })).toBeInTheDocument();
    expect(screen.getByText('Hasta el 22/11')).toBeInTheDocument();
  });
});
