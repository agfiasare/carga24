import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACCESO, PERMITE_CONTRASENA_VENCIDA, type Acceso } from './acceso.decorator.js';
import { SesionesService } from './sesiones.service.js';
import type { Peticion } from './usuario-autenticado.js';

/**
 * Primer control de cada petición: identifica a la persona por su cookie de sesión
 * y verifica que pueda usar la ruta según su @Publico / @SoloJugador / @SoloStaff / @StaffPendiente.
 * Después corre el PermisosGuard.
 */
@Injectable()
export class AutenticacionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sesiones: SesionesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const objetivos = [context.getHandler(), context.getClass()];
    const acceso = this.reflector.getAllAndOverride<Acceso | undefined>(ACCESO, objetivos) ?? 'staff';
    if (acceso === 'publico') return true;

    const peticion = context.switchToHttp().getRequest<Peticion>();
    const ambito = acceso === 'jugador' ? 'jugador' : 'staff';
    const usuario = await this.sesiones.autenticar(peticion, ambito);
    if (!usuario) throw new UnauthorizedException('Tenés que iniciar sesión');

    if (acceso === 'staff' && usuario.nivel !== 'completa') {
      throw new UnauthorizedException('Terminá de ingresar con tu código de verificación');
    }
    if (acceso === 'staff_pendiente' && usuario.nivel !== 'pendiente') {
      throw new ForbiddenException('Ya completaste el ingreso');
    }
    if (acceso === 'jugador' && usuario.debeCambiarContrasena) {
      const permite = this.reflector.getAllAndOverride<boolean | undefined>(PERMITE_CONTRASENA_VENCIDA, objetivos);
      if (!permite) throw new ForbiddenException({ mensaje: 'Tenés que cambiar tu contraseña', codigo: 'cambiar_contrasena' });
    }
    peticion.usuario = usuario;
    return true;
  }
}
