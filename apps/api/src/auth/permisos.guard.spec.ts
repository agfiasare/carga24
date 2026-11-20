import { describe, expect, it } from 'vitest';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permiso } from '@carga24/shared';
import { PERMISOS_ALTERNATIVOS, PERMISOS_REQUERIDOS } from './permisos.decorator.js';
import { PermisosGuard } from './permisos.guard.js';
import type { UsuarioAutenticado } from './usuario-autenticado.js';

function contexto(usuario?: UsuarioAutenticado): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ usuario }) }),
  } as unknown as ExecutionContext;
}

function guardQueExige(todos: Permiso[] | undefined, alguno?: Permiso[]): PermisosGuard {
  const metadatos: Record<string, Permiso[] | undefined> = { [PERMISOS_REQUERIDOS]: todos, [PERMISOS_ALTERNATIVOS]: alguno };
  const reflector = { getAllAndOverride: (clave: string) => metadatos[clave] } as unknown as Reflector;
  return new PermisosGuard(reflector);
}

const base = { sesionId: 'x', nivel: 'completa', debeCambiarContrasena: false } as const;
const staff = (permisos: Permiso[]): UsuarioAutenticado => ({ ...base, id: 's1', tipo: 'staff', permisos: new Set(permisos) });

describe('PermisosGuard', () => {
  it('deja pasar rutas sin permisos requeridos', () => {
    expect(guardQueExige(undefined).canActivate(contexto())).toBe(true);
  });

  it('pide iniciar sesión si no hay usuario', () => {
    expect(() => guardQueExige(['pedidos.tomar']).canActivate(contexto())).toThrow(UnauthorizedException);
  });

  it('rechaza a un jugador aunque la ruta exista', () => {
    const jugador: UsuarioAutenticado = { ...base, id: 'j1', tipo: 'jugador', permisos: new Set() };
    expect(() => guardQueExige(['pedidos.tomar']).canActivate(contexto(jugador))).toThrow(ForbiddenException);
  });

  it('rechaza al staff sin el permiso', () => {
    expect(() => guardQueExige(['pedidos.acreditar']).canActivate(contexto(staff(['pedidos.tomar'])))).toThrow(
      ForbiddenException,
    );
  });

  it('deja pasar al staff con todos los permisos', () => {
    const guard = guardQueExige(['pedidos.tomar', 'pedidos.verificar']);
    expect(guard.canActivate(contexto(staff(['pedidos.tomar', 'pedidos.verificar'])))).toBe(true);
  });

  it('con "alguno de" alcanza con un permiso', () => {
    const guard = guardQueExige(undefined, ['staff.gestionar', 'perfiles.gestionar']);
    expect(guard.canActivate(contexto(staff(['perfiles.gestionar'])))).toBe(true);
    expect(() => guard.canActivate(contexto(staff(['pedidos.ver'])))).toThrow(ForbiddenException);
  });
});
