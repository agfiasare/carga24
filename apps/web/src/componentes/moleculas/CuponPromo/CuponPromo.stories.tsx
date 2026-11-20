import type { Meta, StoryObj } from '@storybook/react-vite';
import { CuponPromo } from './CuponPromo';

const meta = {
  title: 'Moléculas/CuponPromo',
  component: CuponPromo,
  decorators: [(S) => <div style={{ padding: 16, maxWidth: 420 }}><S /></div>],
  args: { titulo: 'Finde 10% extra', condiciones: 'Cargas desde $5.000 de viernes a domingo.', codigo: 'FINDE10', vigencia: 'Hasta el 22/11' },
} satisfies Meta<typeof CuponPromo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Basico: Story = {};
export const EnPanel: Story = { decorators: [(S) => <div data-tema="staff" style={{ padding: 16 }}><S /></div>] };
export const TextoLargo: Story = { args: { titulo: 'Bono de bienvenida para nuevos jugadores', condiciones: 'Tu primera carga suma 20% extra, hasta $10.000 de bono. Una vez por persona.', codigo: 'BIENVENIDA20' } };
