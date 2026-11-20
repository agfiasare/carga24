import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Validar } from '../comun/validacion.js';
import { PermiteContrasenaVencida, Publico, SoloJugador } from './acceso.decorator.js';
import { AuthService } from './auth.service.js';
import {
  esquemaCambioContrasena,
  esquemaIngreso,
  esquemaRegistro,
  type DatosCambioContrasena,
  type DatosIngreso,
  type DatosRegistro,
} from './esquemas.js';
import { SesionesService } from './sesiones.service.js';
import { Usuario } from './usuario.decorator.js';
import type { Peticion, UsuarioAutenticado } from './usuario-autenticado.js';

@Controller()
export class AuthJugadorController {
  constructor(
    private readonly auth: AuthService,
    private readonly sesiones: SesionesService,
  ) {}

  @Publico()
  @Post('auth/jugador/registro')
  async registrar(
    @Body(new Validar(esquemaRegistro)) datos: DatosRegistro,
    @Req() peticion: Peticion,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    const jugador = await this.auth.registrarJugador(datos, peticion.ip);
    await this.sesiones.crear(jugador.id, 'jugador', 'completa', peticion, respuesta);
    return this.auth.perfilJugador(jugador.id);
  }

  @Publico()
  @Post('auth/jugador/ingreso')
  @HttpCode(200)
  async ingresar(
    @Body(new Validar(esquemaIngreso)) datos: DatosIngreso,
    @Req() peticion: Peticion,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    const jugador = await this.auth.validarIngreso('jugador', datos, peticion.ip);
    await this.sesiones.crear(jugador.id, 'jugador', 'completa', peticion, respuesta);
    return this.auth.perfilJugador(jugador.id);
  }

  @SoloJugador()
  @PermiteContrasenaVencida()
  @Post('auth/jugador/salir')
  @HttpCode(204)
  async salir(@Usuario() usuario: UsuarioAutenticado, @Res({ passthrough: true }) respuesta: Response): Promise<void> {
    await this.sesiones.cerrar(usuario.sesionId, 'jugador', respuesta);
  }

  @SoloJugador()
  @PermiteContrasenaVencida()
  @Get('yo')
  yo(@Usuario() usuario: UsuarioAutenticado) {
    return this.auth.perfilJugador(usuario.id);
  }

  @SoloJugador()
  @PermiteContrasenaVencida()
  @Post('yo/contrasena')
  @HttpCode(204)
  async cambiarContrasena(
    @Usuario() usuario: UsuarioAutenticado,
    @Body(new Validar(esquemaCambioContrasena)) datos: DatosCambioContrasena,
    @Req() peticion: Peticion,
  ): Promise<void> {
    await this.auth.cambiarContrasena(usuario, datos, peticion.ip);
  }
}
