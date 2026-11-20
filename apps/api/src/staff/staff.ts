import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { esPermiso, type Permiso } from '@carga24/shared';
import { z } from 'zod';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { SoloStaff } from '../auth/acceso.decorator.js';
import { hashear } from '../auth/contrasenas.js';
import { INCLUIR_PERMISOS, permisosDe } from '../auth/permisos-usuario.js';
import { RequierePermisos } from '../auth/permisos.decorator.js';
import { SesionesService } from '../auth/sesiones.service.js';
import { Usuario } from '../auth/usuario.decorator.js';
import type { Peticion, UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { generarContrasenaTemporal } from '../comun/cripto.js';
import { traducirDuplicado } from '../comun/errores-prisma.js';
import { esquemaNombreUsuario, Validar } from '../comun/validacion.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { verificarQueQuedaAdministrador } from './administracion.js';

const esquemaPermiso = z.string().refine(esPermiso, { message: 'Ese permiso no existe' }) as unknown as z.ZodType<Permiso>;

export const esquemaAjustes = z
  .array(z.object({ permiso: esquemaPermiso, tipo: z.enum(['agregar', 'quitar']) }))
  .max(100)
  .refine((lista) => new Set(lista.map((a) => a.permiso)).size === lista.length, { message: 'Hay permisos repetidos' });

const esquemaNombreVisible = z.string().trim().min(2, 'El nombre es muy corto').max(40, 'El nombre es muy largo');
const esquemaComision = z.number().int().min(0).max(10_000).nullable();

const esquemaCrear = z.object({
  nombreUsuario: esquemaNombreUsuario,
  nombreVisible: esquemaNombreVisible,
  perfilId: z.uuid('Elegí un perfil'),
  ajustes: esquemaAjustes.default([]),
  comisionOperadorPb: esquemaComision.optional(),
});

const esquemaEditar = z
  .object({
    nombreVisible: esquemaNombreVisible.optional(),
    perfilId: z.uuid('Elegí un perfil').optional(),
    comisionOperadorPb: esquemaComision.optional(),
    estado: z.enum(['activo', 'bloqueado']).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No hay cambios para guardar' });

const esquemaReemplazarAjustes = z.object({ ajustes: esquemaAjustes });

type DatosCrear = z.infer<typeof esquemaCrear>;
type DatosEditar = z.infer<typeof esquemaEditar>;
type Ajuste = z.infer<typeof esquemaAjustes>[number];

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly sesiones: SesionesService,
  ) {}

  async listar() {
    const lista = await this.prisma.usuario.findMany({ where: { tipo: 'staff' }, include: INCLUIR_PERMISOS, orderBy: { creadoEn: 'asc' } });
    return lista.map((s) => this.presentar(s));
  }

  async obtener(id: string) {
    const staff = await this.prisma.usuario.findFirst({ where: { id, tipo: 'staff' }, include: INCLUIR_PERMISOS });
    if (!staff) throw new NotFoundException('No encontramos a esa persona del staff');
    return this.presentar(staff);
  }

  async crear(datos: DatosCrear, actor: UsuarioAutenticado, ip?: string) {
    await this.verificarPerfil(datos.perfilId);
    const contrasenaTemporal = generarContrasenaTemporal();
    const creado = await this.prisma
      .$transaction(async (tx) => {
        const staff = await tx.usuario.create({
          data: {
            tipo: 'staff',
            nombreUsuario: datos.nombreUsuario,
            nombreVisible: datos.nombreVisible,
            perfilId: datos.perfilId,
            comisionOperadorPb: datos.comisionOperadorPb ?? null,
            contrasenaHash: await hashear(contrasenaTemporal),
            debeCambiarContrasena: true,
            creadoPorId: actor.id,
          },
        });
        await tx.ajustePermiso.createMany({ data: datos.ajustes.map((a) => ({ ...a, usuarioId: staff.id, otorgadoPorId: actor.id })) });
        await this.auditoria.registrar(
          { actorId: actor.id, accion: 'staff.crear', entidad: 'usuario', entidadId: staff.id, datos: { perfilId: datos.perfilId, ajustes: datos.ajustes }, ip },
          tx,
        );
        return staff;
      })
      .catch(traducirDuplicado);
    return { staff: await this.obtener(creado.id), contrasenaTemporal };
  }

  async editar(id: string, datos: DatosEditar, actor: UsuarioAutenticado, ip?: string) {
    const esUnoMismo = id === actor.id;
    if (esUnoMismo && Object.keys(datos).some((campo) => campo !== 'nombreVisible')) {
      throw new ForbiddenException('No podés cambiar tu propio perfil, estado ni comisión. Pedíselo a otra persona con el permiso.');
    }
    await this.obtener(id);
    if (datos.perfilId) await this.verificarPerfil(datos.perfilId);
    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id },
        data: { nombreVisible: datos.nombreVisible, perfilId: datos.perfilId, comisionOperadorPb: datos.comisionOperadorPb, estado: datos.estado },
      });
      await verificarQueQuedaAdministrador(tx);
      await this.auditoria.registrar({ actorId: actor.id, accion: 'staff.editar', entidad: 'usuario', entidadId: id, datos: { ...datos }, ip }, tx);
    });
    if (datos.estado === 'bloqueado') await this.sesiones.cerrarTodas(id);
    return this.obtener(id);
  }

  async reemplazarAjustes(id: string, ajustes: Ajuste[], actor: UsuarioAutenticado, ip?: string) {
    if (id === actor.id) throw new ForbiddenException('No podés cambiar tus propios permisos. Pedíselo a otra persona con el permiso.');
    await this.obtener(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.ajustePermiso.deleteMany({ where: { usuarioId: id } });
      await tx.ajustePermiso.createMany({ data: ajustes.map((a) => ({ ...a, usuarioId: id, otorgadoPorId: actor.id })) });
      await verificarQueQuedaAdministrador(tx);
      await this.auditoria.registrar({ actorId: actor.id, accion: 'staff.ajustes', entidad: 'usuario', entidadId: id, datos: { ajustes }, ip }, tx);
    });
    return this.obtener(id);
  }

  async resetearContrasena(id: string, actor: UsuarioAutenticado, ip?: string) {
    this.noAUnoMismo(id, actor, 'Para cambiar tu contraseña usá "Mi cuenta".');
    await this.obtener(id);
    const contrasenaTemporal = generarContrasenaTemporal();
    await this.prisma.usuario.update({ where: { id }, data: { contrasenaHash: await hashear(contrasenaTemporal), debeCambiarContrasena: true } });
    await this.sesiones.cerrarTodas(id);
    await this.auditoria.registrar({ actorId: actor.id, accion: 'staff.resetear_contrasena', entidad: 'usuario', entidadId: id, ip });
    return { contrasenaTemporal };
  }

  /** Para cuando alguien pierde el celular: en su próximo ingreso vuelve a escanear el QR. */
  async resetear2fa(id: string, actor: UsuarioAutenticado, ip?: string) {
    this.noAUnoMismo(id, actor, 'Pedile a otra persona con el permiso que te resetee el 2FA.');
    await this.obtener(id);
    await this.prisma.usuario.update({ where: { id }, data: { dosFactoresSecreto: null } });
    await this.sesiones.cerrarTodas(id);
    await this.auditoria.registrar({ actorId: actor.id, accion: 'staff.resetear_2fa', entidad: 'usuario', entidadId: id, ip });
  }

  private noAUnoMismo(id: string, actor: UsuarioAutenticado, mensaje: string): void {
    if (id === actor.id) throw new ForbiddenException(mensaje);
  }

  private async verificarPerfil(perfilId: string): Promise<void> {
    const existe = await this.prisma.perfil.findUnique({ where: { id: perfilId } });
    if (!existe) throw new BadRequestException('Ese perfil no existe');
  }

  private presentar(staff: Prisma.UsuarioGetPayload<{ include: typeof INCLUIR_PERMISOS }>) {
    return {
      id: staff.id,
      nombreUsuario: staff.nombreUsuario,
      nombreVisible: staff.nombreVisible,
      estado: staff.estado,
      perfil: staff.perfil ? { id: staff.perfil.id, nombre: staff.perfil.nombre } : null,
      ajustes: staff.ajustesPermisos.map((a) => ({ permiso: a.permiso, tipo: a.tipo })),
      permisos: [...permisosDe(staff)].sort(),
      tiene2fa: staff.dosFactoresSecreto !== null,
      debeCambiarContrasena: staff.debeCambiarContrasena,
      comisionOperadorPb: staff.comisionOperadorPb,
      creadoEn: staff.creadoEn,
    };
  }
}

@SoloStaff()
@RequierePermisos('staff.gestionar')
@Controller('staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  listar() {
    return this.staff.listar();
  }

  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.staff.obtener(id);
  }

  @Post()
  crear(@Body(new Validar(esquemaCrear)) datos: DatosCrear, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion) {
    return this.staff.crear(datos, actor, peticion.ip);
  }

  @Patch(':id')
  editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new Validar(esquemaEditar)) datos: DatosEditar,
    @Usuario() actor: UsuarioAutenticado,
    @Req() peticion: Peticion,
  ) {
    return this.staff.editar(id, datos, actor, peticion.ip);
  }

  @Put(':id/ajustes')
  reemplazarAjustes(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new Validar(esquemaReemplazarAjustes)) datos: { ajustes: Ajuste[] },
    @Usuario() actor: UsuarioAutenticado,
    @Req() peticion: Peticion,
  ) {
    return this.staff.reemplazarAjustes(id, datos.ajustes, actor, peticion.ip);
  }

  @Post(':id/resetear-contrasena')
  @HttpCode(200)
  resetearContrasena(@Param('id', ParseUUIDPipe) id: string, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion) {
    return this.staff.resetearContrasena(id, actor, peticion.ip);
  }

  @Post(':id/resetear-2fa')
  @HttpCode(204)
  async resetear2fa(@Param('id', ParseUUIDPipe) id: string, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion): Promise<void> {
    await this.staff.resetear2fa(id, actor, peticion.ip);
  }
}
