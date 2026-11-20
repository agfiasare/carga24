import type { Meta, StoryObj } from '@storybook/react-vite';
import { ESTADOS_PEDIDO } from '@carga24/shared';
import { InsigniaEstado } from './InsigniaEstado';

const meta = {
  title: 'Átomos/Insignia de estado',
  component: InsigniaEstado,
  args: { estado: 'en_proceso', tipo: 'carga' },
  argTypes: {
    estado: { control: 'select', options: ESTADOS_PEDIDO },
    tipo: { control: 'inline-radio', options: ['carga', 'retiro'] },
  },
} satisfies Meta<typeof InsigniaEstado>;

export default meta;
type Historia = StoryObj<typeof meta>;

export const EnProceso: Historia = {};

export const TodosLosEstados: Historia = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {ESTADOS_PEDIDO.map((estado) => (
        <InsigniaEstado key={estado} estado={estado} tipo="carga" />
      ))}
    </div>
  ),
};
