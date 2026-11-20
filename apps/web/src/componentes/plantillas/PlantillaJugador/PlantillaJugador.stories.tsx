import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { PlantillaJugador } from './PlantillaJugador';

const meta = {
  title: 'Plantillas/PlantillaJugador',
  component: PlantillaJugador,
  parameters: { layout: 'fullscreen' },
  decorators: [(S) => <MemoryRouter initialEntries={['/historial']}><S /></MemoryRouter>],
  args: { titulo: 'Tus pedidos', noLeidas: 2, children: <p>Contenido de la sección.</p> },
} satisfies Meta<typeof PlantillaJugador>;
export default meta;
export const Basica: StoryObj<typeof meta> = {};
export const SinAvisos: StoryObj<typeof meta> = { args: { noLeidas: 0, volver: { a: '/inicio', texto: 'Inicio' } } };
