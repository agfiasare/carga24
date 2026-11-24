import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  type MessageEvent,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  Sse,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { COMPROBANTE_TAMANO_MAXIMO } from '@carga24/shared';
import type { Response } from 'express';
import { filter, interval, map, merge, type Observable } from 'rxjs';
import { z } from 'zod';
import { SoloJugador } from '../auth/acceso.decorator.js';
import { Usuario } from '../auth/usuario.decorator.js';
import type { Peticion, UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { Validar } from '../comun/validacion.js';
import { EventosPedidos } from '../pedidos/eventos.service.js';
import { PortalService, type DatosCuenta, type DatosPedidoWeb } from './portal.service.js';

const esquemaCuenta = z.object({
  cbuCvu: z
    .string({ error: 'Falta el CBU o CVU' })
    .transform((v) => v.replace(/[\s-]/g, ''))
    .pipe(z.string().regex(/^\d{22}$/, 'El CBU o CVU tiene 22 números')),
  alias: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9.-]{6,20}$/, 'El alias tiene de 6 a 20 letras, números, puntos o guiones')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  banco: z.string().trim().max(60).optional(),
  titular: z.string().trim().max(80).optional(),
});

// Llega como formulario (multipart), así que los números vienen como texto.
const esquemaPedido = z.object({
  tipo: z.enum(['carga', 'retiro'], { error: 'Elegí carga o retiro' }),
  monto: z.coerce.number({ error: 'Escribí el monto' }).int('El monto va en centavos').positive('El monto tiene que ser mayor a cero').max(100_000_000_000),
  cuentaId: z.uuid('Elegí una cuenta'),
  codigoPromo: z.string().trim().max(20).optional().transform((v) => v || undefined),
  plataformaId: z.uuid('Elegí una plataforma').optional().or(z.literal('').transform(() => undefined)),
});

const esquemaListado = z.object({
  estado: z.enum(['en_curso', 'cerrados']).optional(),
  tipo: z.enum(['carga', 'retiro']).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
});

const esquemaLeidas = z.object({ ids: z.array(z.uuid()).max(100).optional() });

const subida = FileInterceptor('archivo', { limits: { fileSize: COMPROBANTE_TAMANO_MAXIMO, files: 1 } });

@SoloJugador()
@Controller('yo')
export class PortalController {
  constructor(
    private readonly portal: PortalService,
    private readonly eventos: EventosPedidos,
  ) {}

  @Get('parametros')
  parametros() {
    return this.portal.parametros();
  }

  @Get('cuentas')
  cuentas(@Usuario() jugador: UsuarioAutenticado) {
    return this.portal.cuentas(jugador.id);
  }

  @Post('cuentas')
  agregarCuenta(@Usuario() jugador: UsuarioAutenticado, @Body(new Validar(esquemaCuenta)) datos: DatosCuenta, @Req() peticion: Peticion) {
    return this.portal.agregarCuenta(jugador, datos, peticion.ip);
  }

  @Delete('cuentas/:id')
  @HttpCode(204)
  async quitarCuenta(@Usuario() jugador: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.portal.quitarCuenta(jugador.id, id);
  }

  @Get('pedidos')
  misPedidos(@Usuario() jugador: UsuarioAutenticado, @Query(new Validar(esquemaListado)) filtro: z.infer<typeof esquemaListado>) {
    return this.portal.misPedidos(jugador.id, filtro);
  }

  /** Carga (con el comprobante en el mismo envío) o retiro. */
  @Post('pedidos')
  @UseInterceptors(subida)
  crearPedido(
    @Usuario() jugador: UsuarioAutenticado,
    @Body(new Validar(esquemaPedido)) datos: DatosPedidoWeb,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Req() peticion: Peticion,
  ) {
    return this.portal.crearPedido(jugador, datos, archivo, peticion.ip);
  }

  /** Avisos en vivo de los pedidos propios (Server-Sent Events). */
  @Sse('eventos')
  eventosEnVivo(@Usuario() jugador: UsuarioAutenticado): Observable<MessageEvent> {
    const propios = this.eventos.flujo().pipe(
      filter((e) => e.jugadorId === jugador.id),
      map((e): MessageEvent => ({ type: 'pedido.actualizado', data: { pedidoId: e.pedidoId, estado: e.estado } })),
    );
    return merge(propios, interval(25_000).pipe(map((): MessageEvent => ({ type: 'latido', data: {} }))));
  }

  @Get('pedidos/:id')
  miPedido(@Usuario() jugador: UsuarioAutenticado, @Param('id', ParseIntPipe) id: number) {
    return this.portal.miPedido(jugador.id, id);
  }

  @Post('pedidos/:id/comprobantes')
  @UseInterceptors(subida)
  adjuntar(@Usuario() jugador: UsuarioAutenticado, @Param('id', ParseIntPipe) id: number, @UploadedFile() archivo: Express.Multer.File | undefined, @Req() peticion: Peticion) {
    if (!archivo) throw new BadRequestException('Adjuntá el archivo del comprobante');
    return this.portal.adjuntar(jugador, id, archivo, peticion.ip);
  }

  @Get('comprobantes/:id')
  async comprobante(@Usuario() jugador: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string, @Res() respuesta: Response): Promise<void> {
    const { comprobante, flujo } = await this.portal.comprobante(jugador.id, id);
    respuesta.set({
      'Content-Type': comprobante.mime,
      'Content-Length': String(comprobante.tamanoBytes),
      'Content-Disposition': `inline; filename="comprobante-${comprobante.pedidoId}.${comprobante.mime === 'application/pdf' ? 'pdf' : comprobante.mime.split('/')[1]}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    flujo.on('error', () => respuesta.destroy());
    flujo.pipe(respuesta);
  }

  @Get('notificaciones')
  notificaciones(@Usuario() jugador: UsuarioAutenticado) {
    return this.portal.notificaciones(jugador.id);
  }

  @Post('notificaciones/leidas')
  @HttpCode(200)
  marcarLeidas(@Usuario() jugador: UsuarioAutenticado, @Body(new Validar(esquemaLeidas)) datos: z.infer<typeof esquemaLeidas>) {
    return this.portal.marcarLeidas(jugador.id, datos.ids);
  }

  @Get('novedades')
  novedades() {
    return this.portal.novedades();
  }
}
