import { describe, expect, it } from 'vitest';
import { seguirPeticion, suscribirActividad } from './actividad';

describe('actividad de la API', () => {
  it('cuenta las peticiones en curso, también las que fallan', async () => {
    const vistos: number[] = [];
    const cancelar = suscribirActividad((n) => vistos.push(n));
    let resolver!: () => void;
    const una = seguirPeticion(new Promise<void>((r) => (resolver = r)));
    const otra = seguirPeticion(Promise.reject(new Error('x'))).catch(() => undefined);
    await otra;
    resolver();
    await una;
    cancelar();
    expect(vistos).toEqual([0, 1, 2, 1, 0]);
  });
});
