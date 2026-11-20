import type { Meta, StoryObj } from '@storybook/react-vite';
import { Casilla } from './Casilla';

const meta = { title: 'Átomos/Casilla', component: Casilla, args: { etiqueta: 'Tomar pedidos' } } satisfies Meta<typeof Casilla>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Basica: Story = {};
export const Marcada: Story = { args: { defaultChecked: true } };
export const ConDetalle: Story = { args: { detalle: 'pedidos.tomar' } };
export const Deshabilitada: Story = { args: { disabled: true, defaultChecked: true } };
