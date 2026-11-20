import type { Meta, StoryObj } from '@storybook/react-vite';
import { Selector } from './Selector';

const meta = {
  title: 'Átomos/Selector',
  component: Selector,
  args: {
    'aria-label': 'Perfil',
    opciones: [
      { valor: 'op', texto: 'Operador' },
      { valor: 'pa', texto: 'Pagos' },
      { valor: 'su', texto: 'Supervisor' },
    ],
  },
} satisfies Meta<typeof Selector>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Basico: Story = {};
export const ConVacio: Story = { args: { vacio: 'Elegí un perfil' } };
export const Invalido: Story = { args: { invalido: true, vacio: 'Elegí un perfil' } };
