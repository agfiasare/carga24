import type { Meta, StoryObj } from '@storybook/react-vite';
import { LogoCargando } from './LogoCargando';

const meta = { title: 'Átomos/LogoCargando', component: LogoCargando } satisfies Meta<typeof LogoCargando>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Chico: Story = { args: { tamano: 28 } };
export const ConTexto: Story = { args: { tamano: 32, mostrarTexto: true } };
export const PantallaCompleta: Story = { args: { tamano: 96 } };
