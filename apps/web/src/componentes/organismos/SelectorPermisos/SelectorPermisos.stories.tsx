import type { Meta, StoryObj } from '@storybook/react-vite';
import { PERFILES_INICIALES, type Permiso } from '@carga24/shared';
import { useState } from 'react';
import { SelectorPermisos } from './SelectorPermisos';

const meta = {
  title: 'Organismos/SelectorPermisos',
  component: SelectorPermisos,
  decorators: [(S) => <div data-tema="staff" style={{ padding: 16 }}><S /></div>],
  args: { valor: new Set<Permiso>(PERFILES_INICIALES.Operador), onCambiar: () => undefined },
  render: function Render(args) {
    const [valor, setValor] = useState(args.valor);
    return <SelectorPermisos {...args} valor={valor} onCambiar={setValor} />;
  },
} satisfies Meta<typeof SelectorPermisos>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Perfil: Story = {};
export const AjustesSobreElPerfil: Story = {
  args: {
    base: new Set<Permiso>(PERFILES_INICIALES.Operador),
    valor: new Set<Permiso>([...(PERFILES_INICIALES.Operador ?? []).filter((p) => p !== 'pedidos.rechazar'), 'jugadores.bloquear']),
  },
};
export const SoloLectura: Story = { args: { deshabilitado: true } };
