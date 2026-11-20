import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  type MessageEvent,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  Sse,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { COMPROBANTE_TAMANO_MAXIMO, MOTIVOS_RECHAZO, type AccionPedido, type MotivoRechazo } from '@carga24/shared';
import type { Response } from 'express';
import { interval, map, merge, type Observable } from 'rxjs';
import { z } from 'zod';
import { SoloStaff } from '../auth/acceso.decorator.js';
import { RequiereAlgunPermiso, RequierePermisos } from '../auth/permisos.decorator.js';
import { Usuario } from '../auth/usuario.decorator.js';
import type { Peticion, UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { Validar } from '../comun/validacion.js';
import { EventosPedidos } from './eventos.service.js';
import { PedidosService, type DatosNuevoPedido } from './pedidos.service.js';

const esquemaNuevo = z
  .object({
    tipo: z.enum(['carga', 'retiro'], { error: 'Elegí carga o retiro' }),
    jugadorId: z.uuid().optional(),
    telefono: z.string().trim().min(1).max(30).optional(),
    plataformaId: z.uuid('Elegí una plataforma'),
    monto: z.number({ error: 'Escribí el monto' }).int('El monto va en centavos enteros').positive('El monto tiene que ser mayor a cero').max(100_000_000_000),
    medioPago: z.enum(['cuenta_registrada', 'otra_cuenta', 'efectivo'], { error: 'Elegí el medio de pago' }),
    cuentaId: z.uuid().optional(),
    nota: z.string().trim().max(300).optional(),
    codigoPromo: z.string().trim().max(20).optional(),
  })
  .refine((d) => d.jugadorId || d.telefono, { message: 'Elegí un jugador o escribí un teléfono', path: ['jugadorId'] });

const esquemaVerificar = z.object({ referenciaMovimiento: z.string().trim().max(60, 'El número de operación es demasiado largo').optional() });

const esquemaRechazar = z.object({
  motivo: z.enum(Object.keys(MOTIVOS_RECHAZO) as [MotivoRechazo, ...MotivoRechazo[]], { error: 'Elegí un motivo' }),
  detalle: z.string().trim().max(300).optional(),
});

const esquemaComprobante = z.object({ tipo: z.enum(['pago', 'retiro']).default('pago') });

@SoloStaff()
@Controller()
export class PedidosController {
  constructor(
    private readonly pedidos: PedidosService,
    private readonly eventos: EventosPedidos,
  ) {}

  /** Comisión, límites y plataformas, para el formulario de alta y los modales. */
  @Get('pedidos/parametros')
  @RequiereAlgunPermiso('pedidos.ver', 'pedidos.crear')
  parametros() {
    return this.pedidos.parametros();
  }

  @Get('pedidos/cola')
  @RequierePermisos('pedidos.ver')
  cola() {
    return this.pedidos.cola();
  }

  /** Cola en vivo (Server-Sent Events): avisa cuando entra o cambia un pedido. */
  @Sse('pedidos/eventos')
  @RequierePermisos('pedidos.ver')
  eventosEnVivo(): Observable<MessageEvent> {
    const avisos = this.eventos.flujo().pipe(map(({ jugadorId: _jugadorId, ...e }): MessageEvent => ({ type: e.tipo, data: e })));
    // Un latido cada 25 s mantiene viva la conexión a través de proxies.
    const latido = interval(25_000).pipe(map((): MessageEvent => ({ type: 'latido', data: {} })));
    return merge(avisos, latido);
  }

  @Get('pedidos/:id')
  @RequierePermisos('pedidos.ver')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.pedidos.obtener(id);
  }

  @Post('pedidos')
  @RequierePermisos('pedidos.crear')
  crear(@Body(new Validar(esquemaNuevo)) datos: DatosNuevoPedido, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion) {
    return this.pedidos.crear(datos, actor, peticion.ip);
  }

  @Post('pedidos/:id/tomar')
  @HttpCode(200)
  @RequierePermisos('pedidos.tomar')
  tomar(@Param('id', ParseIntPipe) id: number, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion) {
    return this.accion(id, 'tomar', actor, peticion);
  }

  @Post('pedidos/:id/liberar')
  @HttpCode(200)
  @RequierePermisos('pedidos.tomar')
  liberar(@Param('id', ParseIntPipe) id: number, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion) {
    return this.accion(id, 'liberar', actor, peticion);
  }

  /** Carga: "encontré el pago" (con número de operación). Retiro: "lo validé". */
  @Post('pedidos/:id/verificar')
  @HttpCode(200)
  @RequierePermisos('pedidos.verificar')
  verificar(
    @Param('id', ParseIntPipe) id: number,
    @Body(new Validar(esquemaVerificar)) datos: z.infer<typeof esquemaVerificar>,
    @Usuario() actor: UsuarioAutenticado,
    @Req() peticion: Peticion,
  ) {
    return this.pedidos.accionar(id, 'verificar', actor, datos, peticion.ip);
  }

  @Post('pedidos/:id/aprobar')
  @HttpCode(200)
  @RequierePermisos('pedidos.aprobar_retiro')
  aprobar(@Param('id', ParseIntPipe) id: number, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion) {
    return this.accion(id, 'aprobar', actor, peticion);
  }

  @Post('pedidos/:id/acreditar')
  @HttpCode(200)
  @RequierePermisos('pedidos.acreditar')
  acreditar(@Param('id', ParseIntPipe) id: number, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion) {
    return this.accion(id, 'acreditar', actor, peticion);
  }

  @Post('pedidos/:id/pagar')
  @HttpCode(200)
  @RequierePermisos('pedidos.pagar')
  pagar(@Param('id', ParseIntPipe) id: number, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion) {
    return this.accion(id, 'pagar', actor, peticion);
  }

  @Post('pedidos/:id/rechazar')
  @HttpCode(200)
  @RequierePermisos('pedidos.rechazar')
  rechazar(
    @Param('id', ParseIntPipe) id: number,
    @Body(new Validar(esquemaRechazar)) datos: z.infer<typeof esquemaRechazar>,
    @Usuario() actor: UsuarioAutenticado,
    @Req() peticion: Peticion,
  ) {
    return this.pedidos.accionar(id, 'rechazar', actor, datos, peticion.ip);
  }

  @Post('pedidos/:id/comprobantes')
  @RequiereAlgunPermiso('pedidos.crear', 'pedidos.verificar', 'pedidos.pagar')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: COMPROBANTE_TAMANO_MAXIMO, files: 1 } }))
  adjuntar(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Body(new Validar(esquemaComprobante)) datos: z.infer<typeof esquemaComprobante>,
    @Usuario() actor: UsuarioAutenticado,
    @Req() peticion: Peticion,
  ) {
    if (!archivo) throw new BadRequestException('Adjuntá el archivo del comprobante');
    return this.pedidos.adjuntar(id, datos.tipo, archivo, actor, peticion.ip);
  }

  @Get('comprobantes/:id')
  @RequierePermisos('pedidos.ver')
  async verComprobante(@Param('id', ParseUUIDPipe) id: string, @Res() respuesta: Response): Promise<void> {
    const { comprobante, flujo } = await this.pedidos.archivoComprobante(id);
    const extension = comprobante.mime === 'application/pdf' ? 'pdf' : comprobante.mime.split('/')[1];
    respuesta.set({
      'Content-Type': comprobante.mime,
      'Content-Length': String(comprobante.tamanoBytes),
      'Content-Disposition': `inline; filename="comprobante-${comprobante.pedidoId}.${extension}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(comprobante.mime.startsWith('image/') ? { 'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'" } : {}),
    });
    flujo.on('error', () => respuesta.destroy());
    flujo.pipe(respuesta);
  }

  private accion(id: number, accion: AccionPedido, actor: UsuarioAutenticado, peticion: Peticion) {
    return this.pedidos.accionar(id, accion, actor, {}, peticion.ip);
  }
}
