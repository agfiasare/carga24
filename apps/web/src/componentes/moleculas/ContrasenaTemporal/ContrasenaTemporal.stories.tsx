import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ContrasenaTemporal } from './ContrasenaTemporal';

const meta = {
  title: 'Moléculas/ContrasenaTemporal',
  component: ContrasenaTemporal,
  decorators: [(S) => <div data-tema="staff" style={{ minHeight: 400 }}><S /></div>],
  args: { para: 'juanp', contrasena: 'K7M-29QX', alCerrar: fn() },
} satisfies Meta<typeof ContrasenaTemporal>;
export default meta;
export const Basica: StoryObj<typeof meta> = {};
