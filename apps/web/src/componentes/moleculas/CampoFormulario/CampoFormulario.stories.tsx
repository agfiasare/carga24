import type { Meta, StoryObj } from '@storybook/react-vite';
import { Phone } from 'lucide-react';
import { CampoFormulario } from './CampoFormulario';

const meta = {
  title: 'Moléculas/Campo de formulario',
  component: CampoFormulario,
  args: { etiqueta: 'Teléfono (el de WhatsApp)', placeholder: '11 5555 0001', type: 'tel', icono: <Phone size={18} /> },
} satisfies Meta<typeof CampoFormulario>;

export default meta;
type Historia = StoryObj<typeof meta>;

export const ConAyuda: Historia = { args: { ayuda: 'Si ya pediste por WhatsApp, tus pedidos aparecen solos.' } };
export const ConError: Historia = { args: { error: 'Ese teléfono ya tiene una cuenta', defaultValue: '11 5555 0001' } };
