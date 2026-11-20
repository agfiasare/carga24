import type { Meta, StoryObj } from '@storybook/react-vite';
import { House, Shield, UserCog, Users } from 'lucide-react';
import { MemoryRouter } from 'react-router';
import { Boton } from '../../atomos/Boton/Boton';
import { PlantillaPanel } from './PlantillaPanel';

const meta = {
  title: 'Plantillas/PlantillaPanel',
  component: PlantillaPanel,
  parameters: { layout: 'fullscreen' },
  decorators: [(S) => <MemoryRouter initialEntries={['/panel/jugadores']}><S /></MemoryRouter>],
  args: {
    menu: [
      { a: '/panel', texto: 'Inicio', icono: <House size={18} /> },
      { a: '/panel/jugadores', texto: 'Jugadores', icono: <Users size={18} /> },
      { a: '/panel/staff', texto: 'Staff', icono: <UserCog size={18} /> },
      { a: '/panel/perfiles', texto: 'Perfiles', icono: <Shield size={18} /> },
    ],
    usuario: { nombre: 'Laura', perfil: 'Supervisor' },
    alSalir: () => undefined,
    titulo: 'Jugadores',
    acciones: <Boton>Nuevo jugador</Boton>,
    children: <p>Contenido de la sección.</p>,
  },
} satisfies Meta<typeof PlantillaPanel>;
export default meta;
export const Escritorio: StoryObj<typeof meta> = {};
export const Celular: StoryObj<typeof meta> = { globals: { viewport: { value: 'mobile1' } } };
