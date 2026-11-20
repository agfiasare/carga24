import { Controller, Get, Module } from '@nestjs/common';
import { Publico } from './auth/acceso.decorator.js';
import { PrismaService } from './prisma/prisma.service.js';
import { PromocionesModule, PromocionesService } from './promociones/promociones.js';

/** Datos para la landing, sin sesión: horario, WhatsApp, plataforma y la promo destacada. */
@Publico()
@Controller('publico')
export class PublicoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promociones: PromocionesService,
  ) {}

  @Get('landing')
  async landing() {
    const [config, plataforma, promos] = await Promise.all([
      this.prisma.configuracion.findMany({ where: { clave: { in: ['atencion.horario', 'atencion.whatsapp'] } } }),
      this.prisma.plataforma.findFirst({ where: { activa: true }, orderBy: { nombre: 'asc' }, select: { nombre: true } }),
      this.promociones.vigentesEn('landing'),
    ]);
    const valor = (clave: string) => {
      const v = config.find((f) => f.clave === clave)?.valor;
      return typeof v === 'string' ? v : '';
    };
    return { horario: valor('atencion.horario'), whatsapp: valor('atencion.whatsapp'), plataforma: plataforma?.nombre ?? null, promo: promos[0] ?? null };
  }
}

@Module({ imports: [PromocionesModule], controllers: [PublicoController] })
export class PublicoModule {}
