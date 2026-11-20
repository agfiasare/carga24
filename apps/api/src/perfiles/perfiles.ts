import {
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { esPermiso, PERMISOS, TODOS_LOS_PERMISOS, type Permiso } from '@carga24/shared';
import { z } from 'zod';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { SoloStaff } from '../auth/acceso.decorator.js';
import { RequiereAlgunPermiso, RequierePermisos } from '../auth/permisos.decorator.js';
import { Usuario } from '../auth/usuario.decorator.js';
import type { Peticion, UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { traducirDuplicado } from '../comun/errores-prisma.js';
import { Validar } from '../comun/validacion.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { verificarQueQuedaAdministrador } from '../staff/administracion.js';

const esquemaPerfil = z.object({
  nombre: z.string().trim().min(2, 'El nombre es muy corto').max(40, 'El nombre es muy largo'),
  descripcion: z.string().trim().max(200).nullable().optional(),
  permisos: z
    .array(z.string().refine(esPermiso, { message: 'Ese permiso no existe' }))
    .max(TODOS_LOS_PERMISOS.length)
    .transform((lista) => [...new Set(lista)] as Permiso[]),
});
type DatosPerfil = z.infer<typeof esquemaPerfil>;

@Injectable()
export class PerfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar() {
    const perfiles = await this.prisma.perfil.findMany({
      include: { permisos: true, _count: { select: { usuarios: true } } },
      orderBy: { creadoEn: 'asc' },
    });
    return perfiles.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion,
      permisos: p.permisos.map((x) => x.permiso).filter(esPermiso).sort(),
      cantidadUsuarios: p._count.usuarios,
    }));
  }

  async crear(datos: DatosPerfil, actor: UsuarioAutenticado, ip?: string) {
    const perfil = await this.prisma
      .$transaction(async (tx) => {
        const creado = await tx.perfil.create({
          data: { nombre: datos.nombre, descripcion: datos.descripcion ?? null, permisos: { create: datos.permisos.map((permiso) => ({ permiso })) } },
        });
        await this.auditoria.registrar({ actorId: actor.id, accion: 'perfil.crear', entidad: 'perfil', entidadId: creado.id, datos: { ...datos }, ip }, tx);
        return creado;
      })
      .catch(traducirDuplicado);
    return this.obtener(perfil.id);
  }

  async editar(id: string, datos: DatosPerfil, actor: UsuarioAutenticado, ip?: string) {
    await this.existe(id);
    const propio = await this.prisma.usuario.findUniqueOrThrow({ where: { id: actor.id }, select: { perfilId: true } });
    if (propio.perfilId === id) {
      throw new ForbiddenException('No podés editar el perfil que tenés asignado: cambiaría tus propios permisos.');
    }
    await this.prisma
      .$transaction(async (tx) => {
        await tx.perfil.update({ where: { id }, data: { nombre: datos.nombre, descripcion: datos.descripcion ?? null } });
        await tx.perfilPermiso.deleteMany({ where: { perfilId: id } });
        await tx.perfilPermiso.createMany({ data: datos.permisos.map((permiso) => ({ perfilId: id, permiso })) });
        await verificarQueQuedaAdministrador(tx);
        await this.auditoria.registrar({ actorId: actor.id, accion: 'perfil.editar', entidad: 'perfil', entidadId: id, datos: { ...datos }, ip }, tx);
      })
      .catch(traducirDuplicado);
    return this.obtener(id);
  }

  async eliminar(id: string, actor: UsuarioAutenticado, ip?: string) {
    const perfil = await this.obtener(id);
    if (perfil.cantidadUsuarios > 0) {
      throw new ConflictException(`No se puede borrar: lo usan ${perfil.cantidadUsuarios} persona(s). Primero cambiales el perfil.`);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.perfil.delete({ where: { id } });
      await this.auditoria.registrar({ actorId: actor.id, accion: 'perfil.eliminar', entidad: 'perfil', entidadId: id, datos: { nombre: perfil.nombre }, ip }, tx);
    });
  }

  async obtener(id: string) {
    const perfil = (await this.listar()).find((p) => p.id === id);
    if (!perfil) throw new NotFoundException('No encontramos ese perfil');
    return perfil;
  }

  private async existe(id: string): Promise<void> {
    if (!(await this.prisma.perfil.findUnique({ where: { id } }))) throw new NotFoundException('No encontramos ese perfil');
  }
}

@SoloStaff()
@Controller()
export class PerfilesController {
  constructor(private readonly perfiles: PerfilesService) {}

  /** Catálogo de permisos agrupado, para armar las pantallas de perfiles y ajustes. */
  @Get('permisos')
  @RequiereAlgunPermiso('staff.gestionar', 'perfiles.gestionar')
  catalogo() {
    return TODOS_LOS_PERMISOS.map((clave) => ({ clave, ...PERMISOS[clave] }));
  }

  /** También lo necesita quien da de alta staff, para elegir el perfil. */
  @Get('perfiles')
  @RequiereAlgunPermiso('staff.gestionar', 'perfiles.gestionar')
  listar() {
    return this.perfiles.listar();
  }

  @Post('perfiles')
  @RequierePermisos('perfiles.gestionar')
  crear(@Body(new Validar(esquemaPerfil)) datos: DatosPerfil, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion) {
    return this.perfiles.crear(datos, actor, peticion.ip);
  }

  @Put('perfiles/:id')
  @RequierePermisos('perfiles.gestionar')
  editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new Validar(esquemaPerfil)) datos: DatosPerfil,
    @Usuario() actor: UsuarioAutenticado,
    @Req() peticion: Peticion,
  ) {
    return this.perfiles.editar(id, datos, actor, peticion.ip);
  }

  @Delete('perfiles/:id')
  @HttpCode(204)
  @RequierePermisos('perfiles.gestionar')
  async eliminar(@Param('id', ParseUUIDPipe) id: string, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion): Promise<void> {
    await this.perfiles.eliminar(id, actor, peticion.ip);
  }
}
