import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { z } from 'zod';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { Publico, SoloJugador, SoloStaff } from '../auth/acceso.decorator.js';
import { RequierePermisos } from '../auth/permisos.decorator.js';
import { Usuario } from '../auth/usuario.decorator.js';
import type { Peticion, UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { traducirDuplicado } from '../comun/errores-prisma.js';
import { Validar } from '../comun/validacion.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { inicioDeFecha } from '../reportes/fechas.js';

export const esquemaCodigo = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{4,20}$/, 'El código lleva de 4 a 20 letras o números, sin espacios');

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha con formato AAAA-MM-DD');
const base = z.object({
  titulo: z.string().trim().min(3, 'El título es muy corto').max(60, 'El título es muy largo'),
  condiciones: z.string().trim().min(3, 'Escribí las condiciones').max(300, 'Las condiciones son muy largas'),
  codigo: esquemaCodigo,
  desde: fecha,
  hasta: fecha,
  activa: z.boolean(),
  enLanding: z.boolean(),
  enInicio: z.boolean(),
  enNovedades: z.boolean(),
});
const esquemaNueva = base
  .extend({ activa: z.boolean().default(true), enLanding: z.boolean().default(false), enInicio: z.boolean().default(false), enNovedades: z.boolean().default(false) })
  .refine((d) => d.desde <= d.hasta, { message: 'La fecha de inicio tiene que ser anterior al fin', path: ['desde'] });
const esquemaEditar = base.partial().refine((d) => Object.keys(d).length > 0, { message: 'No hay cambios para guardar' });
type DatosPromo = z.infer<typeof esquemaEditar>;

const lugares = { landing: 'enLanding', inicio: 'enInicio', novedades: 'enNovedades' } as const;
const esquemaLugar = z.object({ lugar: z.enum(['landing', 'inicio', 'novedades']) });

/** "Desde" es el inicio de ese día y "hasta" el final, en hora de Argentina. */
function vigencia(desde: string, hasta: string) {
  return { desde: inicioDeFecha(desde), hasta: new Date(inicioDeFecha(hasta).getTime() + 24 * 60 * 60 * 1000 - 1) };
}

const PUBLICO = { id: true, titulo: true, condiciones: true, codigo: true, hasta: true } as const;

@Injectable()
export class PromocionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private vigentes(ahora = new Date()): Prisma.PromocionWhereInput {
    return { activa: true, desde: { lte: ahora }, hasta: { gte: ahora } };
  }

  async listar() {
    const ahora = new Date();
    const promos = await this.prisma.promocion.findMany({ include: { _count: { select: { pedidos: true } } }, orderBy: { desde: 'desc' } });
    return promos.map(({ _count, ...p }) => ({
      ...p,
      usos: _count.pedidos,
      situacion: !p.activa ? 'pausada' : p.desde > ahora ? 'programada' : p.hasta < ahora ? 'vencida' : 'vigente',
    }));
  }

  vigentesEn(lugar: keyof typeof lugares) {
    return this.prisma.promocion.findMany({ where: { ...this.vigentes(), [lugares[lugar]]: true }, select: PUBLICO, orderBy: { hasta: 'asc' } });
  }

  /** La promo vigente con ese código, o un 400 claro. */
  async validar(codigo: string) {
    const normalizado = codigo.trim().toUpperCase();
    const promo = await this.prisma.promocion.findFirst({ where: { codigo: normalizado, ...this.vigentes() }, select: PUBLICO });
    if (!promo) throw new BadRequestException('Ese código de promo no existe o ya no está vigente');
    return promo;
  }

  async guardar(id: string | null, datos: DatosPromo, actor: UsuarioAutenticado, ip?: string) {
    const actual = id ? await this.prisma.promocion.findUnique({ where: { id } }) : null;
    if (id && !actual) throw new NotFoundException('No existe esa promoción');
    const desde = datos.desde ?? (actual ? actual.desde.toISOString().slice(0, 10) : undefined);
    const hasta = datos.hasta ?? (actual ? new Date(actual.hasta.getTime() - 3 * 3600_000).toISOString().slice(0, 10) : undefined);
    if (desde && hasta && desde > hasta) throw new BadRequestException('La fecha de inicio tiene que ser anterior al fin');
    const fechas = datos.desde || datos.hasta ? vigencia(desde!, hasta!) : {};
    const { desde: _d, hasta: _h, ...resto } = datos;
    const promo = await this.prisma
      .$transaction(async (tx) => {
        const guardada = id
          ? await tx.promocion.update({ where: { id }, data: { ...resto, ...fechas } })
          : await tx.promocion.create({ data: { ...(resto as Required<typeof resto>), ...(fechas as { desde: Date; hasta: Date }) } });
        await this.auditoria.registrar({ actorId: actor.id, accion: id ? 'promo.editar' : 'promo.crear', entidad: 'promocion', entidadId: guardada.id, datos: { ...datos }, ip }, tx);
        return guardada;
      })
      .catch((e: unknown) => {
        if ((e as { code?: string }).code === 'P2002') throw new ConflictException('Ya hay una promoción con ese código');
        return traducirDuplicado(e);
      });
    return promo;
  }

  async eliminar(id: string, actor: UsuarioAutenticado, ip?: string) {
    const promo = await this.prisma.promocion.findUnique({ where: { id }, include: { _count: { select: { pedidos: true } } } });
    if (!promo) throw new NotFoundException('No existe esa promoción');
    if (promo._count.pedidos > 0) throw new ConflictException('Ya se usó en pedidos: pausala en lugar de borrarla');
    await this.prisma.promocion.delete({ where: { id } });
    await this.auditoria.registrar({ actorId: actor.id, accion: 'promo.eliminar', entidad: 'promocion', entidadId: id, datos: { codigo: promo.codigo }, ip });
  }
}

@Controller('promociones')
export class PromocionesController {
  constructor(private readonly promos: PromocionesService) {}

  /** Para la landing (sin sesión), el inicio del jugador y novedades. */
  @Publico()
  @Get('vigentes')
  vigentes(@Query(new Validar(esquemaLugar)) consulta: z.infer<typeof esquemaLugar>) {
    return this.promos.vigentesEn(consulta.lugar);
  }

  @SoloJugador()
  @Get('validar/:codigo')
  validarJugador(@Param('codigo') codigo: string) {
    return this.promos.validar(codigo);
  }

  @SoloStaff()
  @RequierePermisos('promos.aplicar')
  @Get('staff/validar/:codigo')
  validarStaff(@Param('codigo') codigo: string) {
    return this.promos.validar(codigo);
  }

  @SoloStaff()
  @RequierePermisos('promos.gestionar')
  @Get()
  listar() {
    return this.promos.listar();
  }

  @SoloStaff()
  @RequierePermisos('promos.gestionar')
  @Post()
  crear(@Body(new Validar(esquemaNueva)) datos: DatosPromo, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion) {
    return this.promos.guardar(null, datos, actor, peticion.ip);
  }

  @SoloStaff()
  @RequierePermisos('promos.gestionar')
  @Patch(':id')
  editar(@Param('id', ParseUUIDPipe) id: string, @Body(new Validar(esquemaEditar)) datos: DatosPromo, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion) {
    return this.promos.guardar(id, datos, actor, peticion.ip);
  }

  @SoloStaff()
  @RequierePermisos('promos.gestionar')
  @Delete(':id')
  @HttpCode(204)
  async eliminar(@Param('id', ParseUUIDPipe) id: string, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion): Promise<void> {
    await this.promos.eliminar(id, actor, peticion.ip);
  }
}

@Module({ controllers: [PromocionesController], providers: [PromocionesService], exports: [PromocionesService] })
export class PromocionesModule {}
