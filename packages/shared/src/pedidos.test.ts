import { describe, expect, it } from 'vitest';
import { columnaDe, esFinal, siguienteEstado } from './pedidos.js';
import { PERFILES_INICIALES, permisosEfectivos } from './permisos.js';

describe('siguienteEstado', () => {
  it('recorre el camino feliz de una carga', () => {
    expect(siguienteEstado('carga', 'pendiente', 'tomar')).toBe('en_proceso');
    expect(siguienteEstado('carga', 'en_proceso', 'verificar')).toBe('verificado');
    expect(siguienteEstado('carga', 'verificado', 'acreditar')).toBe('acreditado');
  });

  it('un retiro se paga, no se acredita', () => {
    expect(siguienteEstado('retiro', 'verificado', 'pagar')).toBe('pagado');
    expect(siguienteEstado('retiro', 'verificado', 'acreditar')).toBeNull();
  });

  it('un retiro grande pasa por aprobación', () => {
    expect(siguienteEstado('retiro', 'en_proceso', 'enviar_a_aprobacion')).toBe('espera_aprobacion');
    expect(siguienteEstado('retiro', 'espera_aprobacion', 'aprobar')).toBe('verificado');
  });

  it('no permite saltear pasos ni salir de un estado final', () => {
    expect(siguienteEstado('carga', 'pendiente', 'acreditar')).toBeNull();
    expect(siguienteEstado('carga', 'acreditado', 'rechazar')).toBeNull();
    expect(esFinal('rechazado')).toBe(true);
  });
});

describe('permisosEfectivos', () => {
  it('perfil + agregados − quitados', () => {
    const efectivos = permisosEfectivos(PERFILES_INICIALES.Operador ?? [], [
      { permiso: 'pedidos.acreditar', tipo: 'agregar' },
      { permiso: 'jugadores.crear', tipo: 'quitar' },
    ]);
    expect(efectivos.has('pedidos.acreditar')).toBe(true);
    expect(efectivos.has('jugadores.crear')).toBe(false);
    expect(efectivos.has('pedidos.tomar')).toBe(true);
  });
});

describe('columnaDe', () => {
  it('ubica cada estado en su columna de la cola', () => {
    expect(columnaDe('pendiente')).toBe('pendientes');
    expect(columnaDe('espera_aprobacion')).toBe('en_proceso');
    expect(columnaDe('verificado')).toBe('por_completar');
    expect(columnaDe('rechazado')).toBe('cerrados');
  });
});
