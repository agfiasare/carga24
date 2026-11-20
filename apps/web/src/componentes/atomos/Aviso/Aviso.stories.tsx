import type { Meta, StoryObj } from '@storybook/react-vite';
import { Aviso } from './Aviso';

const meta = {
  title: 'Átomos/Aviso',
  component: Aviso,
  args: { children: 'Usuario o contraseña incorrectos' },
} satisfies Meta<typeof Aviso>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Error: Story = { args: { tipo: 'error' } };
export const Ok: Story = { args: { tipo: 'ok', children: 'Listo, tu contraseña quedó cambiada.' } };
export const Info: Story = { args: { tipo: 'info', children: 'Te pedimos un código de tu app de autenticación.' } };
