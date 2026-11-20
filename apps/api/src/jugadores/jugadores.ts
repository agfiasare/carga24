import { BadRequestException, Body, Controller, Get, HttpCode, Injectable, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { z } from 'zod';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { SoloStaff } from '../auth/acceso.decorator.js';
import { hashear } from '../auth/contrasenas.js';
import { esquemaTelefono } from '../auth/esquemas.js';
import { RequiereAlgunPermiso, RequierePermisos } from '../auth/permisos.decorator.js';
import { SesionesService } from '../auth/sesiones.service.js';
import { Usuario } from '../auth/usuario.decorator.js';
import type { Peticion, UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { generarContrasenaTemporal } from '../comun/cripto.js';
import { traducirDuplicado } from '../comun/errores-prisma.js';
import { normalizarTelefono } from '../comun/telefono.js';
import { esquemaNombreUsuario, esquemaUsuarioPlataforma, Validar } from '../comun/validacion.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const esquemaNotas = z.string().trim().max(1000, 'Las notas son demasiado largas');

const esquemaCrear = z
  .object({
    usuarioPlataforma: esquemaUsuarioPlataforma,
    telefono: esquemaTelefono.optional(),
    nombreUsuario: esquemaNombreUsuario.optional(),
    notasInternas: esquemaNotas.optional(),
  })
  .refine((d) => d.telefono || d.nombreUsuario, { message: 'Poné un teléfono o un nombre de usuario', path: ['telefono'] });

const esquemaEditar = z
  .object({
    usuarioPlataforma: esquemaUsuarioPlataforma.optional(),
    telefono: esquemaTelefono.nullable().optional(),
    nombreUsuario: esquemaNombreUsuario.nullable().optional(),
    notasInternas: esquemaNotas.nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No hay cambios para guardar' });

type DatosCrear = z.infer<typeof esquemaCrear>;
type DatosEditar = z.infer<typeof esquemaEditar>;

const POR_PAGINA = 50;

const CAMPOS = {
  id: true,
  nombreUsuario: true,
  telefono: true,
  usuarioPlataforma: true,
  estado: true,
  debeCambiarContrasena: true,
  creadoEn: true,
} as const;

@Injectable()
export class JugadoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly sesiones: SesionesService,
  ) {}

  async listar(buscar: string | undefined, pagina: number) {
    const texto = buscar?.trim();
    const digitos = texto ? (normalizarTelefono(texto) ?? texto.replace(/\D/g, '')) : '';
    const where: Prisma.UsuarioWhereInput = {
      tipo: 'jugador',
      ...(texto
        ? {
            OR: [
              { nombreUsuario: { contains: texto, mode: 'insensitive' } },
              { usuarioPlataforma: { contains: texto, mode: 'insensitive' } },
              ...(digitos.length >= 3 ? [{ telefono: { contains: digitos } }] : []),
            ],
          }
        : {}),
    };
    const [total, jugadores] = await Promise.all([
      this.prisma.usuario.count({ where }),
      this.prisma.usuario.findMany({ where, select: CAMPOS, orderBy: { creadoEn: 'desc' }, skip: (pagina - 1) * POR_PAGINA, take: POR_PAGINA }),
    ]);
    return { total, pagina, porPagina: POR_PAGINA, jugadores };
  }

  async obtener(id: string) {
    const jugador = await this.prisma.usuario.findFirst({ where: { id, tipo: 'jugador' }, select: { ...CAMPOS, notasInternas: true } });
    if (!jugador) throw new NotFoundException('No encontramos ese jugador');
    return jugador;
  }

  /** Cuentas bancarias del jugador (para elegir origen o destino al registrar un pedido). */
  async cuentas(id: string) {
    await this.obtener(id);
    return this.prisma.cuentaBancaria.findMany({
      where: { usuarioId: id },
      select: { id: true, cbuCvu: true, alias: true, banco: true, titular: true, estado: true },
      orderBy: { creadoEn: 'asc' },
    });
  }

  async crear(datos: DatosCrear, actor: UsuarioAutenticado, ip?: string) {
    const contrasenaTemporal = generarContrasenaTemporal();
    const jugador = await this.prisma
      .$transaction(async (tx) => {
        const creado = await tx.usuario.create({
          data: {
            tipo: 'jugador',
            usuarioPlataforma: datos.usuarioPlataforma,
            telefono: datos.telefono ?? null,
            nombreUsuario: datos.nombreUsuario ?? null,
            notasInternas: datos.notasInternas || null,
            contrasenaHash: await hashear(contrasenaTemporal),
            debeCambiarContrasena: true,
            creadoPorId: actor.id,
          },
          select: { ...CAMPOS, notasInternas: true },
        });
        if (creado.telefono) {
          await tx.pedido.updateMany({ where: { telefono: creado.telefono, jugadorId: null }, data: { jugadorId: creado.id } });
        }
        await this.auditoria.registrar({ actorId: actor.id, accion: 'jugador.crear', entidad: 'usuario', entidadId: creado.id, ip }, tx);
        return creado;
      })
      .catch(traducirDuplicado);
    // La contraseña temporal se muestra una sola vez para pasársela al jugador.
    return { jugador, contrasenaTemporal };
  }

  async editar(id: string, datos: DatosEditar, actor: UsuarioAutenticado, ip?: string) {
    const actual = await this.obtener(id);
    const telefono = datos.telefono === undefined ? actual.telefono : datos.telefono;
    const nombreUsuario = datos.nombreUsuario === undefined ? actual.nombreUsuario : datos.nombreUsuario;
    if (!telefono && !nombreUsuario) throw new BadRequestException('El jugador tiene que tener teléfono o nombre de usuario');
    const editado = await this.prisma.usuario
      .update({
        where: { id },
        data: {
          usuarioPlataforma: datos.usuarioPlataforma,
          telefono: datos.telefono,
          nombreUsuario: datos.nombreUsuario,
          notasInternas: datos.notasInternas === undefined ? undefined : datos.notasInternas || null,
        },
        select: { ...CAMPOS, notasInternas: true },
      })
      .catch(traducirDuplicado);
    const cambios = Object.keys(datos);
    await this.auditoria.registrar({ actorId: actor.id, accion: 'jugador.editar', entidad: 'usuario', entidadId: id, datos: { cambios }, ip });
    return editado;
  }

  async cambiarEstado(id: string, estado: 'activo' | 'bloqueado', actor: UsuarioAutenticado, ip?: string) {
    await this.obtener(id);
    const jugador = await this.prisma.usuario.update({ where: { id }, data: { estado }, select: CAMPOS });
    if (estado === 'bloqueado') await this.sesiones.cerrarTodas(id);
    await this.auditoria.registrar({ actorId: actor.id, accion: estado === 'bloqueado' ? 'jugador.bloquear' : 'jugador.desbloquear', entidad: 'usuario', entidadId: id, ip });
    return jugador;
  }

  async resetearContrasena(id: string, actor: UsuarioAutenticado, ip?: string) {
    await this.obtener(id);
    const contrasenaTemporal = generarContrasenaTemporal();
    await this.prisma.usuario.update({ where: { id }, data: { contrasenaHash: await hashear(contrasenaTemporal), debeCambiarContrasena: true } });
    await this.sesiones.cerrarTodas(id);
    await this.auditoria.registrar({ actorId: actor.id, accion: 'jugador.resetear_contrasena', entidad: 'usuario', entidadId: id, ip });
    return { contrasenaTemporal };
  }
}

const esquemaListado = z.object({
  buscar: z.string().max(60).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
});

@SoloStaff()
@Controller('jugadores')
export class JugadoresController {
  constructor(private readonly jugadores: JugadoresService) {}

  @Get()
  @RequierePermisos('jugadores.ver')
  listar(@Query(new Validar(esquemaListado)) consulta: z.infer<typeof esquemaListado>) {
    return this.jugadores.listar(consulta.buscar, consulta.pagina);
  }

  @Get(':id')
  @RequierePermisos('jugadores.ver')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.jugadores.obtener(id);
  }

  @Get(':id/cuentas')
  @RequiereAlgunPermiso('jugadores.ver', 'pedidos.crear')
  cuentas(@Param('id', ParseUUIDPipe) id: string) {
    return this.jugadores.cuentas(id);
  }

  @Post()
  @RequierePermisos('jugadores.crear')
  crear(@Body(new Validar(esquemaCrear)) datos: DatosCrear, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion) {
    return this.jugadores.crear(datos, actor, peticion.ip);
  }

  @Patch(':id')
  @RequierePermisos('jugadores.editar')
  editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new Validar(esquemaEditar)) datos: DatosEditar,
    @Usuario() actor: UsuarioAutenticado,
    @Req() peticion: Peticion,
  ) {
    return this.jugadores.editar(id, datos, actor, peticion.ip);
  }

  @Post(':id/bloquear')
  @HttpCode(200)
  @RequierePermisos('jugadores.bloquear')
  bloquear(@Param('id', ParseUUIDPipe) id: string, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion) {
    return this.jugadores.cambiarEstado(id, 'bloqueado', actor, peticion.ip);
  }

  @Post(':id/desbloquear')
  @HttpCode(200)
  @RequierePermisos('jugadores.bloquear')
  desbloquear(@Param('id', ParseUUIDPipe) id: string, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion) {
    return this.jugadores.cambiarEstado(id, 'activo', actor, peticion.ip);
  }

  @Post(':id/resetear-contrasena')
  @HttpCode(200)
  @RequierePermisos('jugadores.resetear_contrasena')
  resetearContrasena(@Param('id', ParseUUIDPipe) id: string, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion) {
    return this.jugadores.resetearContrasena(id, actor, peticion.ip);
  }
}
