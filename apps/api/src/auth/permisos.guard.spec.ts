import { describe, expect, it } from 'vitest';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permiso } from '@carga24/shared';
import { PermisosGuard } from './permisos.guard.js';
import type { UsuarioAutenticado } from './usuario-autenticado.js';

function contexto(usuario?: UsuarioAutenticado): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ usuario }) }),
  } as unknown as ExecutionContext;
}

function guardQueExige(permisos: Permiso[] | undefined): PermisosGuard {
  const reflector = { getAllAndOverride: () => permisos } as unknown as Reflector;
  return new PermisosGuard(reflector);
}

const staff = (permisos: Permiso[]): UsuarioAutenticado => ({ id: 's1', tipo: 'staff', permisos: new Set(permisos) });

describe('PermisosGuard', () => {
  it('deja pasar rutas sin permisos requeridos', () => {
    expect(guardQueExige(undefined).canActivate(contexto())).toBe(true);
  });

  it('pide iniciar sesión si no hay usuario', () => {
    expect(() => guardQueExige(['pedidos.tomar']).canActivate(contexto())).toThrow(UnauthorizedException);
  });

  it('rechaza a un jugador aunque la ruta exista', () => {
    const jugador: UsuarioAutenticado = { id: 'j1', tipo: 'jugador', permisos: new Set() };
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
});
