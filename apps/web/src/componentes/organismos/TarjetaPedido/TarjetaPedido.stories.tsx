import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Boton } from '../../atomos/Boton/Boton';
import { TarjetaPedido } from './TarjetaPedido';

const meta = {
  title: 'Organismos/TarjetaPedido',
  component: TarjetaPedido,
  decorators: [(S) => <div data-tema="staff" style={{ padding: 16, maxWidth: 320 }}><S /></div>],
  args: {
    alAbrir: fn(),
    pedido: {
      id: 1291,
      tipo: 'carga',
      estado: 'pendiente',
      canal: 'manual',
      medioPago: 'cuenta_registrada',
      monto: 1_000_000,
      montoPagado: 1_050_000,
      jugador: 'ana',
      cuando: 'hace 3 min',
      comprobantes: 1,
    },
    acciones: (
      <>
        <Boton tamano="md">Tomar</Boton>
        <Boton variante="secundario">Rechazar</Boton>
      </>
    ),
  },
} satisfies Meta<typeof TarjetaPedido>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CargaPendiente: Story = {};
export const Nueva: Story = { args: { nuevo: true } };
export const RetiroTomado: Story = {
  args: {
    pedido: { id: 1292, tipo: 'retiro', estado: 'en_proceso', canal: 'web', medioPago: 'cuenta_registrada', monto: 20_000_000, montoPagado: null, jugador: '+54 9 11 5555-0001', cuando: 'hace 12 min', tomadoPor: 'Laura', comprobantes: 0, requiereAprobacion: true },
    acciones: <Boton>Validar retiro</Boton>,
  },
};
export const Rechazado: Story = {
  args: {
    pedido: { id: 1290, tipo: 'carga', estado: 'rechazado', canal: 'manual', medioPago: 'otra_cuenta', monto: 500_000, montoPagado: 525_000, jugador: 'juanp', cuando: '13:05', comprobantes: 0, motivoRechazo: 'El pago no llegó' },
    acciones: undefined,
  },
};
