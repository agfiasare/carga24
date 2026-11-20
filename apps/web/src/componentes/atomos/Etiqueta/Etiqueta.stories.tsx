import type { Meta, StoryObj } from '@storybook/react-vite';
import { Etiqueta } from './Etiqueta';

const meta = { title: 'Átomos/Etiqueta', component: Etiqueta, args: { children: 'Activo' } } satisfies Meta<typeof Etiqueta>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Neutro: Story = { args: { children: 'Operador' } };
export const Ok: Story = { args: { tono: 'ok' } };
export const Aviso: Story = { args: { tono: 'aviso', children: 'Sin 2FA' } };
export const Error: Story = { args: { tono: 'error', children: 'Bloqueado' } };
export const EnPanel: Story = { args: { tono: 'ok' }, decorators: [(S) => <div data-tema="staff" style={{ padding: 16 }}><S /></div>] };
