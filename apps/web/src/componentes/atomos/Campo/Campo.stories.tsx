import type { Meta, StoryObj } from '@storybook/react-vite';
import { Lock, User } from 'lucide-react';
import { Campo } from './Campo';

const meta = {
  title: 'Átomos/Campo',
  component: Campo,
  args: { placeholder: 'juanperez', 'aria-label': 'Usuario o teléfono' },
} satisfies Meta<typeof Campo>;

export default meta;
type Historia = StoryObj<typeof meta>;

export const Basico: Historia = {};
export const ConIcono: Historia = { args: { icono: <User size={18} /> } };
export const Contrasena: Historia = { args: { type: 'password', icono: <Lock size={18} />, placeholder: '••••••••', 'aria-label': 'Contraseña' } };
export const Invalido: Historia = { args: { invalido: true, defaultValue: 'usuario inexistente' } };
