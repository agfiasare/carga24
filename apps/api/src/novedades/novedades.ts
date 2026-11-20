import { Body, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { SoloStaff } from '../auth/acceso.decorator.js';
import { RequierePermisos } from '../auth/permisos.decorator.js';
import { Usuario } from '../auth/usuario.decorator.js';
import type { Peticion, UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { Validar } from '../comun/validacion.js';
import { PrismaService } from '../prisma/prisma.service.js';

const esquemaNueva = z.object({
  titulo: z.string().trim().min(3, 'El título es muy corto').max(80, 'El título es muy largo'),
  texto: z.string().trim().min(1, 'Escribí el texto').max(2000, 'El texto es muy largo'),
  fijada: z.boolean().default(false),
  publicada: z.boolean().default(false),
});
const esquemaEditar = esquemaNueva.partial().refine((d) => Object.keys(d).length > 0, { message: 'No hay cambios para guardar' });
type DatosNovedad = z.infer<typeof esquemaEditar>;

/** Novedades para los jugadores: borrador o publicada, y una sola fijada arriba. */
@Injectable()
export class NovedadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  listar() {
    return this.prisma.novedad.findMany({ orderBy: [{ fijada: 'desc' }, { creadoEn: 'desc' }] });
  }

  async guardar(id: string | null, datos: DatosNovedad, actor: UsuarioAutenticado, ip?: string) {
    if (id && !(await this.prisma.novedad.findUnique({ where: { id } }))) throw new NotFoundException('No existe esa novedad');
    const novedad = await this.prisma.$transaction(async (tx) => {
      if (datos.fijada) await tx.novedad.updateMany({ where: { fijada: true, ...(id ? { id: { not: id } } : {}) }, data: { fijada: false } });
      const actual = id ? await tx.novedad.findUniqueOrThrow({ where: { id } }) : null;
      const publicadaEn = datos.publicada === undefined ? undefined : datos.publicada ? (actual?.publicadaEn ?? new Date()) : null;
      const cambios = { titulo: datos.titulo, texto: datos.texto, fijada: datos.fijada, publicadaEn };
      return id
        ? tx.novedad.update({ where: { id }, data: cambios })
        : tx.novedad.create({ data: { titulo: datos.titulo!, texto: datos.texto!, fijada: datos.fijada ?? false, publicadaEn: publicadaEn ?? null, autorId: actor.id } });
    });
    await this.auditoria.registrar({ actorId: actor.id, accion: id ? 'novedad.editar' : 'novedad.crear', entidad: 'novedad', entidadId: novedad.id, ip });
    return novedad;
  }

  async eliminar(id: string, actor: UsuarioAutenticado, ip?: string) {
    const { count } = await this.prisma.novedad.deleteMany({ where: { id } });
    if (count === 0) throw new NotFoundException('No existe esa novedad');
    await this.auditoria.registrar({ actorId: actor.id, accion: 'novedad.eliminar', entidad: 'novedad', entidadId: id, ip });
  }
}

@SoloStaff()
@RequierePermisos('novedades.publicar')
@Controller('novedades')
export class NovedadesController {
  constructor(private readonly novedades: NovedadesService) {}

  @Get()
  listar() {
    return this.novedades.listar();
  }

  @Post()
  crear(@Body(new Validar(esquemaNueva)) datos: DatosNovedad, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion) {
    return this.novedades.guardar(null, datos, actor, peticion.ip);
  }

  @Patch(':id')
  editar(@Param('id', ParseUUIDPipe) id: string, @Body(new Validar(esquemaEditar)) datos: DatosNovedad, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion) {
    return this.novedades.guardar(id, datos, actor, peticion.ip);
  }

  @Delete(':id')
  @HttpCode(204)
  async eliminar(@Param('id', ParseUUIDPipe) id: string, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion): Promise<void> {
    await this.novedades.eliminar(id, actor, peticion.ip);
  }
}

@Module({ controllers: [NovedadesController], providers: [NovedadesService] })
export class NovedadesModule {}
