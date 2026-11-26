import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { SoloStaff } from '../auth/acceso.decorator.js';
import { RequiereAlgunPermiso, RequierePermisos } from '../auth/permisos.decorator.js';
import { Usuario } from '../auth/usuario.decorator.js';
import type { Peticion, UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { Validar } from '../comun/validacion.js';
import { CajaService } from './caja.service.js';
import { esquemaAjuste, esquemaCierre, esquemaLiquidacion, esquemaRendicion, type DatosAjuste, type DatosCierre, type DatosLiquidacion, type DatosRendicion } from './esquemas.js';

/** Turnos (cualquiera del staff), caja y rendiciones (según permisos). */
@SoloStaff()
@Controller()
export class CajaController {
  constructor(private readonly caja: CajaService) {}

  @Get('turnos/actual')
  actual(@Usuario() actor: UsuarioAutenticado) {
    return this.caja.actual(actor);
  }

  @Post('turnos')
  abrir(@Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion) {
    return this.caja.abrir(actor, peticion.ip);
  }

  @Get('turnos')
  @RequierePermisos('caja.ver')
  listar() {
    return this.caja.listarTurnos();
  }

  @Get('turnos/:id')
  resumen(@Param('id', ParseUUIDPipe) id: string, @Usuario() actor: UsuarioAutenticado) {
    return this.caja.resumen(id, actor);
  }

  @Post('turnos/:id/cierre')
  @HttpCode(200)
  cerrar(@Param('id', ParseUUIDPipe) id: string, @Body(new Validar(esquemaCierre)) datos: DatosCierre, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion) {
    return this.caja.cerrar(id, datos, actor, peticion.ip);
  }

  @Get('caja')
  @RequierePermisos('caja.ver')
  verCaja() {
    return this.caja.caja();
  }

  @Post('caja/liquidaciones')
  @RequierePermisos('caja.liquidar')
  liquidar(@Body(new Validar(esquemaLiquidacion)) datos: DatosLiquidacion, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion) {
    return this.caja.liquidar(datos, actor, peticion.ip);
  }

  @Post('caja/ajustes')
  @RequierePermisos('caja.ajustar')
  ajustar(@Body(new Validar(esquemaAjuste)) datos: DatosAjuste, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion) {
    return this.caja.ajustar(datos, actor, peticion.ip);
  }

  @Get('rendiciones')
  @RequiereAlgunPermiso('caja.ver', 'rendiciones.registrar')
  rendiciones() {
    return this.caja.rendiciones();
  }

  @Post('rendiciones')
  @RequierePermisos('rendiciones.registrar')
  rendir(@Body(new Validar(esquemaRendicion)) datos: DatosRendicion, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion) {
    return this.caja.rendir(datos, actor, peticion.ip);
  }
}
