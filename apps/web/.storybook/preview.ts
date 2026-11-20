import type { Preview } from '@storybook/react-vite';
import '../src/estilos/globales.css';

const preview: Preview = {
  parameters: {
    layout: 'padded',
    backgrounds: {
      options: {
        mesa: { name: 'Mesa verde', value: '#08251b' },
        panel: { name: 'Panel del staff', value: '#f4f6f9' },
      },
    },
    a11y: { test: 'error' },
  },
  initialGlobals: {
    backgrounds: { value: 'mesa' },
  },
};

export default preview;
