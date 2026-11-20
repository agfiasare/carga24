import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { SoloStaff } from '../auth/acceso.decorator.js';
import { RequierePermisos } from '../auth/permisos.decorator.js';
import { Validar } from '../comun/validacion.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { rangoDeFechas } from '../reportes/fechas.js';

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha con formato AAAA-MM-DD');
const esquemaFiltro = z.object({
  actorId: z.uuid().optional(),
  accion: z.string().max(60).optional(),
  desde: fecha.optional(),
  hasta: fecha.optional(),
  pagina: z.coerce.number().int().min(1).default(1),
});

const POR_PAGINA = 50;

/** Consulta de la auditoría. Solo lectura: la tabla no admite cambios ni borrados (trigger en la base). */
@SoloStaff()
@RequierePermisos('auditoria.ver')
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async listar(@Query(new Validar(esquemaFiltro)) filtro: z.infer<typeof esquemaFiltro>) {
    const rango = rangoDeFechas(filtro.desde, filtro.hasta);
    const where: Prisma.AuditoriaWhereInput = {
      ...(filtro.actorId ? { actorId: filtro.actorId } : {}),
      ...(filtro.accion ? { accion: { startsWith: filtro.accion } } : {}),
      ...(rango ? { creadoEn: rango } : {}),
    };
    const [total, filas] = await Promise.all([
      this.prisma.auditoria.count({ where }),
      this.prisma.auditoria.findMany({ where, orderBy: { id: 'desc' }, skip: (filtro.pagina - 1) * POR_PAGINA, take: POR_PAGINA }),
    ]);
    const actores = await this.prisma.usuario.findMany({
      where: { id: { in: [...new Set(filas.flatMap((f) => (f.actorId ? [f.actorId] : [])))] } },
      select: { id: true, nombreVisible: true, nombreUsuario: true, telefono: true, tipo: true },
    });
    return {
      total,
      pagina: filtro.pagina,
      porPagina: POR_PAGINA,
      registros: filas.map((f) => {
        const actor = actores.find((a) => a.id === f.actorId);
        return {
          id: String(f.id),
          accion: f.accion,
          entidad: f.entidad,
          entidadId: f.entidadId,
          datos: f.datos,
          ip: f.ip,
          creadoEn: f.creadoEn,
          actor: actor ? { id: actor.id, nombre: actor.nombreVisible ?? actor.nombreUsuario ?? actor.telefono ?? '', tipo: actor.tipo } : null,
        };
      }),
    };
  }

  /** Para los filtros: las acciones registradas y quiénes del staff actuaron. */
  @Get('opciones')
  async opciones() {
    const [acciones, actores] = await Promise.all([
      this.prisma.auditoria.findMany({ distinct: ['accion'], select: { accion: true }, orderBy: { accion: 'asc' } }),
      this.prisma.usuario.findMany({ where: { tipo: 'staff' }, select: { id: true, nombreVisible: true, nombreUsuario: true }, orderBy: { nombreVisible: 'asc' } }),
    ]);
    return {
      acciones: acciones.map((a) => a.accion),
      personas: actores.map((a) => ({ id: a.id, nombre: a.nombreVisible ?? a.nombreUsuario ?? '' })),
    };
  }
}
