import type { Meta, StoryObj } from '@storybook/react-vite';
import { Monto } from './Monto';

const meta = {
  title: 'Átomos/Monto',
  component: Monto,
  args: { centavos: 1_000_000 },
  argTypes: {
    movimiento: { control: 'inline-radio', options: [undefined, 'entrada', 'salida'] },
    tamano: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof Monto>;

export default meta;
type Historia = StoryObj<typeof meta>;

export const Normal: Historia = {};
export const Grande: Historia = { args: { tamano: 'lg', destacado: true } };
export const Entrada: Historia = { args: { centavos: 500_000, movimiento: 'entrada', tamano: 'sm' } };
export const Salida: Historia = { args: { centavos: 1_200_000, movimiento: 'salida', tamano: 'sm' } };
export const Rechazado: Historia = { args: { centavos: 300_000, tachado: true, tamano: 'sm' } };
