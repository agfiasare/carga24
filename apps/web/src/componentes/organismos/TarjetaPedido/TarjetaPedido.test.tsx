import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TarjetaPedido, type DatosTarjetaPedido } from './TarjetaPedido';

const carga: DatosTarjetaPedido = {
  id: 7, tipo: 'carga', estado: 'en_proceso', canal: 'manual', medioPago: 'efectivo', monto: 1_000_000, montoPagado: 1_050_000,
  jugador: 'ana', cuando: 'recién', tomadoPor: 'Laura', comprobantes: 2,
};

describe('TarjetaPedido', () => {
  it('muestra qué es, cuánto se acredita, cuánto transfiere y quién lo tiene', () => {
    render(<TarjetaPedido pedido={carga} />);
    expect(screen.getByRole('article', { name: 'Carga #7' })).toBeInTheDocument();
    expect(screen.getByText('WhatsApp · Efectivo')).toBeInTheDocument();
    expect(screen.getByText(/10\.000/)).toBeInTheDocument();
    expect(screen.getByText(/10\.500/)).toBeInTheDocument();
    expect(screen.getByText('Laura')).toBeInTheDocument();
    expect(screen.getByRole('article')).toHaveTextContent('2 comprobantes');
  });

  it('abre el detalle desde el número', async () => {
    const alAbrir = vi.fn();
    render(<TarjetaPedido pedido={carga} alAbrir={alAbrir} />);
    await userEvent.click(screen.getByRole('button', { name: 'Carga #7' }));
    expect(alAbrir).toHaveBeenCalledOnce();
  });
});
