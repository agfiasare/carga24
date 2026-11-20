import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Monto } from './Monto';

describe('Monto', () => {
  it('formatea centavos como pesos', () => {
    const { container } = render(<Monto centavos={1_050_000} />);
    expect(container.textContent).toContain('10.500');
  });

  it('marca entradas y salidas con su signo', () => {
    const { container, rerender } = render(<Monto centavos={500_000} movimiento="entrada" />);
    expect(container.textContent?.startsWith('+')).toBe(true);
    rerender(<Monto centavos={500_000} movimiento="salida" />);
    expect(container.textContent?.startsWith('−')).toBe(true);
  });
});
