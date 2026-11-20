import type { Meta, StoryObj } from '@storybook/react-vite';
import { Check, Send } from 'lucide-react';
import { Boton } from './Boton';

const meta = {
  title: 'Átomos/Botón',
  component: Boton,
  args: { children: 'Pedir carga' },
  argTypes: {
    variante: { control: 'inline-radio', options: ['primario', 'secundario', 'peligro', 'fantasma'] },
    tamano: { control: 'inline-radio', options: ['md', 'lg'] },
  },
} satisfies Meta<typeof Boton>;

export default meta;
type Historia = StoryObj<typeof meta>;

export const Primario: Historia = {};
export const Secundario: Historia = { args: { variante: 'secundario', children: 'Pedir retiro' } };
export const Peligro: Historia = { args: { variante: 'peligro', children: 'Rechazar' } };
export const Fantasma: Historia = { args: { variante: 'fantasma', children: 'Ver todo' } };
export const ConIcono: Historia = { args: { icono: <Send size={18} aria-hidden="true" />, children: 'Enviar pedido', tamano: 'lg' } };
export const Cargando: Historia = { args: { cargando: true, children: 'Enviando…' } };
export const AnchoCompleto: Historia = {
  args: { anchoCompleto: true, icono: <Check size={18} aria-hidden="true" />, children: 'Sí, está acreditada' },
};
