import type { Meta, StoryObj } from '@storybook/react-vite';
import { Boton } from '../../atomos/Boton/Boton';
import { CampoFormulario } from '../../moleculas/CampoFormulario/CampoFormulario';
import { PlantillaAcceso } from './PlantillaAcceso';

const meta = {
  title: 'Plantillas/PlantillaAcceso',
  component: PlantillaAcceso,
  parameters: { layout: 'fullscreen' },
  args: {
    titulo: 'Ingresar',
    bajada: 'Con tu teléfono o tu nombre de usuario.',
    children: (
      <>
        <CampoFormulario etiqueta="Teléfono o usuario" />
        <CampoFormulario etiqueta="Contraseña" type="password" />
        <Boton anchoCompleto tamano="lg">
          Ingresar
        </Boton>
      </>
    ),
  },
} satisfies Meta<typeof PlantillaAcceso>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Jugador: Story = {};
export const Panel: Story = { args: { marca: 'Panel del staff', titulo: 'Ingreso del staff' } };
