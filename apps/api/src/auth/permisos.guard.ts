import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permiso } from '@carga24/shared';
import { PERMISOS_REQUERIDOS } from './permisos.decorator.js';
import type { UsuarioAutenticado } from './usuario-autenticado.js';

/**
 * Controla los permisos de cada ruta marcada con @RequierePermisos.
 * - Sin la marca: la ruta no exige permisos (la protegen otras reglas).
 * - Con la marca: solo pasa una cuenta de staff que tenga TODOS los permisos pedidos.
 * El frontend oculta lo que la persona no puede usar, pero el control real es este.
 */
@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requeridos = this.reflector.getAllAndOverride<Permiso[] | undefined>(PERMISOS_REQUERIDOS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requeridos || requeridos.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ usuario?: UsuarioAutenticado }>();
    const usuario = request.usuario;
    if (!usuario) throw new UnauthorizedException('Tenés que iniciar sesión');
    if (usuario.tipo !== 'staff') throw new ForbiddenException('Esta acción es solo para el staff');

    const faltantes = requeridos.filter((p) => !usuario.permisos.has(p));
    if (faltantes.length > 0) {
      throw new ForbiddenException(`Te falta el permiso: ${faltantes.join(', ')}`);
    }
    return true;
  }
}
