import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Peticion, UsuarioAutenticado } from './usuario-autenticado.js';

/** Inyecta el usuario autenticado en el controlador: `@Usuario() usuario: UsuarioAutenticado`. */
export const Usuario = createParamDecorator((_dato: unknown, context: ExecutionContext): UsuarioAutenticado => {
  const usuario = context.switchToHttp().getRequest<Peticion>().usuario;
  if (!usuario) throw new Error('@Usuario() usado en una ruta pública');
  return usuario;
});
