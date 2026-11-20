import { Body, ConflictException, Controller, Get, Injectable, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Put, Req } from '@nestjs/common';
import { z } from 'zod';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { SoloStaff } from '../auth/acceso.decorator.js';
import { RequiereAlgunPermiso, RequierePermisos } from '../auth/permisos.decorator.js';
import { Usuario } from '../auth/usuario.decorator.js';
import type { Peticion, UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { traducirDuplicado } from '../comun/errores-prisma.js';
import { Validar } from '../comun/validacion.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const centavos = z.number().int('Los montos van en centavos enteros').min(0).max(100_000_000_000);
const texto = (max: number) => z.string().trim().max(max);

const esquemaConfiguracion = z
  .object({
    comision: z.object({ modo: z.enum(['recargo', 'descuento']), porcentajePb: z.number().int().min(0).max(5_000, 'La comisión no puede superar el 50 %') }).partial(),
    montos: z.object({ cargaMinima: centavos, cargaMaxima: centavos, retiroMinimo: centavos, retiroConAprobacionDesde: centavos }).partial(),
    cuentasPendientesMaximas: z.number().int().min(1).max(10),
    pago: z.object({ alias: texto(40), titular: texto(80), banco: texto(60) }).partial(),
    horario: texto(120),
  })
  .partial();
type CambiosConfiguracion = z.infer<typeof esquemaConfiguracion>;

/** Clave de la tabla configuracion para cada campo editable. */
const CLAVES = {
  'comision.modo': ['comision', 'modo'],
  'comision.porcentaje_pb': ['comision', 'porcentajePb'],
  'montos.carga_minima': ['montos', 'cargaMinima'],
  'montos.carga_maxima': ['montos', 'cargaMaxima'],
  'montos.retiro_minimo': ['montos', 'retiroMinimo'],
  'montos.retiro_con_aprobacion_desde': ['montos', 'retiroConAprobacionDesde'],
  'cuentas.pendientes_maximas': ['cuentasPendientesMaximas'],
  'pago.alias': ['pago', 'alias'],
  'pago.titular': ['pago', 'titular'],
  'pago.banco': ['pago', 'banco'],
  'atencion.horario': ['horario'],
} as const;

function leer(objeto: unknown, ruta: readonly string[]): unknown {
  return ruta.reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), objeto);
}

function escribir(objeto: Record<string, unknown>, ruta: readonly string[], valor: unknown): void {
  let actual = objeto;
  for (const k of ruta.slice(0, -1)) actual = (actual[k] ??= {}) as Record<string, unknown>;
  actual[ruta[ruta.length - 1]!] = valor;
}

@Injectable()
export class AdministracionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async configuracion() {
    const filas = await this.prisma.configuracion.findMany({ where: { clave: { in: Object.keys(CLAVES) } } });
    const resultado: Record<string, unknown> = {};
    for (const [clave, ruta] of Object.entries(CLAVES)) escribir(resultado, ruta, filas.find((f) => f.clave === clave)?.valor ?? null);
    const ultima = filas.reduce<Date | null>((m, f) => (!m || f.actualizadoEn > m ? f.actualizadoEn : m), null);
    return { ...resultado, actualizadoEn: ultima };
  }

  /** Guarda solo lo que cambió. Los pedidos ya creados conservan su comisión: cada uno guarda la suya. */
  async guardarConfiguracion(cambios: CambiosConfiguracion, actor: UsuarioAutenticado, ip?: string) {
    const actual = await this.configuracion();
    const final = (ruta: readonly string[]) => leer(cambios, ruta) ?? leer(actual, ruta);
    if (Number(final(['montos', 'cargaMinima'])) > Number(final(['montos', 'cargaMaxima']))) {
      throw new ConflictException('La carga mínima no puede ser mayor que la máxima');
    }
    const modificados = Object.entries(CLAVES).flatMap(([clave, ruta]) => {
      const nuevo = leer(cambios, ruta);
      const anterior = leer(actual, ruta);
      return nuevo !== undefined && nuevo !== anterior ? [{ clave, anterior, nuevo }] : [];
    });
    if (modificados.length === 0) return actual;
    await this.prisma.$transaction(async (tx) => {
      for (const { clave, nuevo } of modificados) {
        const valor = nuevo as Prisma.InputJsonValue;
        await tx.configuracion.upsert({ where: { clave }, update: { valor, actualizadoPorId: actor.id }, create: { clave, valor, actualizadoPorId: actor.id } });
      }
      await this.auditoria.registrar(
        { actorId: actor.id, accion: 'configuracion.editar', entidad: 'configuracion', datos: { cambios: modificados } as unknown as Prisma.InputJsonValue, ip },
        tx,
      );
    });
    return this.configuracion();
  }

  plataformas() {
    return this.prisma.plataforma.findMany({ orderBy: { nombre: 'asc' }, include: { _count: { select: { pedidos: true } } } });
  }

  async guardarPlataforma(id: string | null, datos: { nombre?: string; activa?: boolean }, actor: UsuarioAutenticado, ip?: string) {
    if (id && !(await this.prisma.plataforma.findUnique({ where: { id } }))) throw new NotFoundException('No existe esa plataforma');
    const plataforma = await this.prisma
      .$transaction(async (tx) => {
        const guardada = id ? await tx.plataforma.update({ where: { id }, data: datos }) : await tx.plataforma.create({ data: { nombre: datos.nombre! } });
        if ((await tx.plataforma.count({ where: { activa: true } })) === 0) {
          throw new ConflictException('Tiene que quedar al menos una plataforma activa para tomar pedidos');
        }
        await this.auditoria.registrar({ actorId: actor.id, accion: id ? 'plataforma.editar' : 'plataforma.crear', entidad: 'plataforma', entidadId: guardada.id, datos, ip }, tx);
        return guardada;
      })
      .catch(traducirDuplicado);
    return plataforma;
  }
}

const esquemaPlataforma = z.object({ nombre: z.string().trim().min(2, 'El nombre es muy corto').max(60) });
const esquemaEditarPlataforma = z
  .object({ nombre: z.string().trim().min(2).max(60).optional(), activa: z.boolean().optional() })
  .refine((d) => Object.keys(d).length > 0, { message: 'No hay cambios para guardar' });

@SoloStaff()
@Controller()
export class AdministracionController {
  constructor(private readonly administracion: AdministracionService) {}

  @Get('configuracion')
  @RequierePermisos('configuracion.editar')
  configuracion() {
    return this.administracion.configuracion();
  }

  @Put('configuracion')
  @RequierePermisos('configuracion.editar')
  guardar(@Body(new Validar(esquemaConfiguracion)) cambios: CambiosConfiguracion, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion) {
    return this.administracion.guardarConfiguracion(cambios, actor, peticion.ip);
  }

  @Get('plataformas')
  @RequiereAlgunPermiso('plataformas.gestionar', 'configuracion.editar')
  plataformas() {
    return this.administracion.plataformas();
  }

  @Post('plataformas')
  @RequierePermisos('plataformas.gestionar')
  crearPlataforma(@Body(new Validar(esquemaPlataforma)) datos: { nombre: string }, @Usuario() actor: UsuarioAutenticado, @Req() peticion: Peticion) {
    return this.administracion.guardarPlataforma(null, datos, actor, peticion.ip);
  }

  @Patch('plataformas/:id')
  @RequierePermisos('plataformas.gestionar')
  editarPlataforma(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new Validar(esquemaEditarPlataforma)) datos: { nombre?: string; activa?: boolean },
    @Usuario() actor: UsuarioAutenticado,
    @Req() peticion: Peticion,
  ) {
    return this.administracion.guardarPlataforma(id, datos, actor, peticion.ip);
  }
}
