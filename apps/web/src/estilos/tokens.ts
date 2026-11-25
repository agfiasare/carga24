/**
 * Tokens de diseño de Carga24 (paleta "Mesa verde").
 * Los átomos nunca usan colores escritos a mano: leen estos valores
 * a través de las variables CSS de `globales.css`. Cambiar la marca = cambiar acá y allá.
 */
export const tokens = {
  color: {
    fondo: '#08251B',
    /** Laterales de la app del jugador en pantallas anchas: más oscuro que el fondo. */
    fondoLateral: '#04150F',
    superficie: '#0E3326',
    borde: '#1F5440',
    texto: '#F3F7F2',
    textoSecundario: '#A9C2B5',
    primario: '#E9B949',
    sobrePrimario: '#1E1503',
    destacado: '#F3EAD3',
    estado: {
      ok: '#7EE2A8',
      okFondo: '#12432F',
      enProceso: '#F6D27F',
      enProcesoFondo: '#3A2F0C',
      error: '#E5484D',
      errorFondo: '#3D1416',
    },
    /** Panel del staff: tema claro, pensado para muchas horas frente a la pantalla. */
    staff: {
      fondo: '#F4F6F9',
      superficie: '#FFFFFF',
      borde: '#E3E8EF',
      texto: '#08251B',
      textoSecundario: '#56665F',
      primario: '#0E3326',
      sobrePrimario: '#FFFFFF',
      ok: '#137A48',
      okFondo: '#E3F5EB',
      enProceso: '#8A6300',
      enProcesoFondo: '#FFF4D6',
      error: '#C62F35',
      errorFondo: '#FDECEC',
    },
  },
  fuente: {
    display: "'Archivo', system-ui, sans-serif",
    titulos: "'Space Grotesk', system-ui, sans-serif",
    texto: "'Inter', system-ui, sans-serif",
  },
  radio: { sm: 8, md: 10, lg: 14, pill: 999 },
  espacio: [0, 4, 8, 12, 16, 24, 32],
  tamanoTactil: 44,
} as const;

export type Tokens = typeof tokens;
