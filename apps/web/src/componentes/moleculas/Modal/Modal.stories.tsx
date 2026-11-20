import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Modal, ModalConfirmacion } from './Modal';

const meta = {
  title: 'Moléculas/Modal',
  component: ModalConfirmacion,
  decorators: [(S) => <div data-tema="staff" style={{ minHeight: 400 }}><S /></div>],
  args: {
    titulo: 'Bloquear a juanp',
    children: <p>No va a poder ingresar ni hacer pedidos hasta que lo desbloquees. Se cierran sus sesiones.</p>,
    textoConfirmar: 'Bloquear',
    variante: 'peligro',
    alConfirmar: fn(),
    alCerrar: fn(),
  },
} satisfies Meta<typeof ModalConfirmacion>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Confirmacion: Story = {};
export const Procesando: Story = { args: { cargando: true } };
export const Simple: Story = {
  render: () => (
    <Modal titulo="Detalle" alCerrar={() => undefined}>
      <p>Contenido libre de la ventana.</p>
    </Modal>
  ),
};
