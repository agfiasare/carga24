import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Validar } from '../comun/validacion.js';
import { SoloStaff, StaffPendiente, Publico } from './acceso.decorator.js';
import { AuthService } from './auth.service.js';
import {
  esquemaCambioContrasena,
  esquemaCodigo,
  esquemaContrasenaNueva,
  esquemaIngreso,
  type DatosCambioContrasena,
  type DatosIngreso,
} from './esquemas.js';
import { SesionesService } from './sesiones.service.js';
import { Usuario } from './usuario.decorator.js';
import type { Peticion, UsuarioAutenticado } from './usuario-autenticado.js';

/**
 * Ingreso al panel en pasos:
 * 1. usuario + contraseña → sesión "pendiente".
 * 2. Si la contraseña es temporal: elegir una nueva.
 * 3. Si no tiene 2FA: configurarlo (QR) y activarlo con un código. Si ya lo tiene: ingresar el código.
 * Recién ahí la sesión pasa a "completa" (con un token nuevo).
 */
@Controller()
export class AuthStaffController {
  constructor(
    private readonly auth: AuthService,
    private readonly sesiones: SesionesService,
  ) {}

  @Publico()
  @Post('auth/staff/ingreso')
  @HttpCode(200)
  async ingresar(
    @Body(new Validar(esquemaIngreso)) datos: DatosIngreso,
    @Req() peticion: Peticion,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    const staff = await this.auth.validarIngreso('staff', datos, peticion.ip);
    const siguientePaso = this.auth.siguientePasoStaff(staff);
    // Sin 2FA (DOS_FACTORES=no) y con la contraseña ya elegida, la sesión queda completa de una.
    await this.sesiones.crear(staff.id, 'staff', siguientePaso === 'listo' ? 'completa' : 'pendiente', peticion, respuesta);
    return { siguientePaso };
  }

  @StaffPendiente()
  @Post('auth/staff/contrasena-inicial')
  @HttpCode(200)
  async contrasenaInicial(
    @Usuario() usuario: UsuarioAutenticado,
    @Body(new Validar(esquemaContrasenaNueva)) datos: { nueva: string },
    @Req() peticion: Peticion,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    const staff = await this.auth.elegirContrasenaInicial(usuario, datos.nueva, peticion.ip);
    const siguientePaso = this.auth.siguientePasoStaff(staff);
    if (siguientePaso === 'listo') await this.completarIngreso(usuario, peticion, respuesta);
    return { siguientePaso };
  }

  @StaffPendiente()
  @Post('auth/staff/2fa/configurar')
  @HttpCode(200)
  configurar2fa(@Usuario() usuario: UsuarioAutenticado) {
    return this.auth.configurar2fa(usuario);
  }

  @StaffPendiente()
  @Post('auth/staff/2fa/activar')
  @HttpCode(200)
  async activar2fa(
    @Usuario() usuario: UsuarioAutenticado,
    @Body(new Validar(esquemaCodigo)) datos: { codigo: string },
    @Req() peticion: Peticion,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    await this.auth.activar2fa(usuario, datos.codigo, peticion.ip);
    await this.completarIngreso(usuario, peticion, respuesta);
    return this.auth.perfilStaff(usuario.id);
  }

  @StaffPendiente()
  @Post('auth/staff/2fa/verificar')
  @HttpCode(200)
  async verificar2fa(
    @Usuario() usuario: UsuarioAutenticado,
    @Body(new Validar(esquemaCodigo)) datos: { codigo: string },
    @Req() peticion: Peticion,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    await this.auth.verificar2fa(usuario, datos.codigo, peticion.ip);
    await this.completarIngreso(usuario, peticion, respuesta);
    return this.auth.perfilStaff(usuario.id);
  }

  @StaffPendiente()
  @Get('auth/staff/estado')
  async estado(@Usuario() usuario: UsuarioAutenticado) {
    return { siguientePaso: this.auth.siguientePasoStaff(await this.auth.buscarStaff(usuario.id)) };
  }

  /** Sirve tanto a mitad del ingreso como con la sesión completa. */
  @Publico()
  @Post('auth/staff/salir')
  @HttpCode(204)
  async salir(@Req() peticion: Peticion, @Res({ passthrough: true }) respuesta: Response): Promise<void> {
    const usuario = await this.sesiones.autenticar(peticion, 'staff');
    if (usuario) await this.sesiones.cerrar(usuario.sesionId, 'staff', respuesta);
    else this.sesiones.borrarCookie('staff', respuesta);
  }

  @SoloStaff()
  @Get('auth/staff/yo')
  yo(@Usuario() usuario: UsuarioAutenticado) {
    return this.auth.perfilStaff(usuario.id);
  }

  @SoloStaff()
  @Post('auth/staff/contrasena')
  @HttpCode(204)
  async cambiarContrasena(
    @Usuario() usuario: UsuarioAutenticado,
    @Body(new Validar(esquemaCambioContrasena)) datos: DatosCambioContrasena,
    @Req() peticion: Peticion,
  ): Promise<void> {
    await this.auth.cambiarContrasena(usuario, datos, peticion.ip);
  }

  /** Cambia la sesión pendiente por una completa con token nuevo. */
  private async completarIngreso(usuario: UsuarioAutenticado, peticion: Peticion, respuesta: Response): Promise<void> {
    await this.sesiones.cerrar(usuario.sesionId, 'staff', respuesta);
    await this.sesiones.crear(usuario.id, 'staff', 'completa', peticion, respuesta);
  }
}
