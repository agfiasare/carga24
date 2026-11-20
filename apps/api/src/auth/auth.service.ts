import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { cifrar, descifrar } from '../comun/cripto.js';
import { traducirDuplicado } from '../comun/errores-prisma.js';
import { LimitadorIntentos } from '../comun/limitador.js';
import { normalizarTelefono, pareceTelefono } from '../comun/telefono.js';
import { generarSecreto, uriOtpauth, verificarCodigo } from '../comun/totp.js';
import type { Usuario } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashear, verificarContrasena } from './contrasenas.js';
import { INCLUIR_PERMISOS, permisosDe } from './permisos-usuario.js';
import type { DatosCambioContrasena, DatosIngreso, DatosRegistro } from './esquemas.js';
import { SesionesService } from './sesiones.service.js';
import type { UsuarioAutenticado } from './usuario-autenticado.js';

export type PasoIngresoStaff = 'cambiar_contrasena' | 'configurar_2fa' | 'verificar_2fa';

const CREDENCIALES_INVALIDAS = 'Usuario o contraseña incorrectos';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sesiones: SesionesService,
    private readonly auditoria: AuditoriaService,
    private readonly limitador: LimitadorIntentos,
  ) {}

  // ---------- Jugadores ----------

  async registrarJugador(datos: DatosRegistro, ip?: string) {
    const jugador = await this.prisma
      .$transaction(async (tx) => {
        const creado = await tx.usuario.create({
          data: {
            tipo: 'jugador',
            usuarioPlataforma: datos.usuarioPlataforma,
            telefono: datos.telefono,
            nombreUsuario: datos.nombreUsuario,
            contrasenaHash: await hashear(datos.contrasena),
          },
        });
        // Los pedidos que hizo por WhatsApp antes de registrarse pasan a su cuenta.
        const vinculados = await tx.pedido.updateMany({
          where: { telefono: datos.telefono, jugadorId: null },
          data: { jugadorId: creado.id },
        });
        await this.auditoria.registrar(
          { actorId: creado.id, accion: 'jugador.registro', entidad: 'usuario', entidadId: creado.id, datos: { pedidosVinculados: vinculados.count }, ip },
          tx,
        );
        return creado;
      })
      .catch(traducirDuplicado);
    return jugador;
  }

  perfilJugador(id: string) {
    return this.prisma.usuario.findUniqueOrThrow({
      where: { id },
      select: { id: true, nombreUsuario: true, telefono: true, usuarioPlataforma: true, debeCambiarContrasena: true, creadoEn: true },
    });
  }

  // ---------- Ingreso (jugador y staff) ----------

  /** Valida usuario y contraseña. Lanza 401 genérico, 403 si está bloqueado y 429 si hubo demasiados intentos. */
  async validarIngreso(tipo: 'jugador' | 'staff', datos: DatosIngreso, ip?: string): Promise<Usuario> {
    const identificador = datos.identificador.toLowerCase();
    const claveLimite = `ingreso:${tipo}:${identificador}:${ip ?? ''}`;
    this.limitador.verificar(claveLimite);

    const telefono = pareceTelefono(identificador) ? normalizarTelefono(identificador) : null;
    const usuario = await this.prisma.usuario.findFirst({
      where: { tipo, ...(telefono ? { telefono } : { nombreUsuario: identificador }) },
    });
    const correcta = await verificarContrasena(usuario?.contrasenaHash, datos.contrasena);
    if (!usuario || !correcta) {
      this.limitador.registrarFallo(claveLimite);
      await this.auditoria.registrar({ actorId: usuario?.id ?? null, accion: `${tipo}.ingreso_fallido`, entidad: 'usuario', entidadId: usuario?.id, datos: { identificador }, ip });
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }
    if (usuario.estado !== 'activo') {
      throw new ForbiddenException('Tu cuenta está bloqueada. Escribinos por WhatsApp para resolverlo.');
    }
    this.limitador.limpiar(claveLimite);
    await this.auditoria.registrar({ actorId: usuario.id, accion: `${tipo}.ingreso`, entidad: 'usuario', entidadId: usuario.id, ip });
    return usuario;
  }

  async cambiarContrasena(usuario: UsuarioAutenticado, datos: DatosCambioContrasena, ip?: string): Promise<void> {
    const guardado = await this.prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    const claveLimite = `contrasena:${usuario.id}`;
    this.limitador.verificar(claveLimite);
    if (!(await verificarContrasena(guardado.contrasenaHash, datos.actual))) {
      this.limitador.registrarFallo(claveLimite);
      throw new BadRequestException('La contraseña actual no es correcta');
    }
    if (datos.actual === datos.nueva) throw new BadRequestException('La contraseña nueva tiene que ser distinta');
    this.limitador.limpiar(claveLimite);
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { contrasenaHash: await hashear(datos.nueva), debeCambiarContrasena: false },
    });
    // Las otras sesiones (otro celular, otra compu) se cierran.
    await this.sesiones.cerrarTodas(usuario.id, usuario.sesionId);
    await this.auditoria.registrar({ actorId: usuario.id, accion: `${usuario.tipo}.cambio_contrasena`, entidad: 'usuario', entidadId: usuario.id, ip });
  }

  // ---------- Staff: contraseña inicial y 2FA ----------

  buscarStaff(id: string): Promise<Usuario> {
    return this.prisma.usuario.findUniqueOrThrow({ where: { id } });
  }

  siguientePasoStaff(staff: Pick<Usuario, 'debeCambiarContrasena' | 'dosFactoresSecreto'>): PasoIngresoStaff {
    if (staff.debeCambiarContrasena) return 'cambiar_contrasena';
    return staff.dosFactoresSecreto ? 'verificar_2fa' : 'configurar_2fa';
  }

  async elegirContrasenaInicial(usuario: UsuarioAutenticado, nueva: string, ip?: string): Promise<Usuario> {
    const staff = await this.buscarStaff(usuario.id);
    if (!staff.debeCambiarContrasena) throw new BadRequestException('Tu contraseña ya está elegida');
    if (await verificarContrasena(staff.contrasenaHash, nueva)) {
      throw new BadRequestException('Elegí una contraseña distinta a la temporal');
    }
    const actualizado = await this.prisma.usuario.update({
      where: { id: staff.id },
      data: { contrasenaHash: await hashear(nueva), debeCambiarContrasena: false },
    });
    await this.auditoria.registrar({ actorId: staff.id, accion: 'staff.cambio_contrasena', entidad: 'usuario', entidadId: staff.id, ip });
    return actualizado;
  }

  async configurar2fa(usuario: UsuarioAutenticado): Promise<{ secreto: string; uri: string }> {
    const staff = await this.buscarStaff(usuario.id);
    if (this.siguientePasoStaff(staff) !== 'configurar_2fa') throw new BadRequestException('Este paso no corresponde');
    const secreto = generarSecreto();
    await this.prisma.sesion.update({ where: { id: usuario.sesionId }, data: { secretoPendiente: cifrar(secreto) } });
    return { secreto, uri: uriOtpauth(secreto, staff.nombreUsuario ?? staff.id) };
  }

  async activar2fa(usuario: UsuarioAutenticado, codigo: string, ip?: string): Promise<void> {
    const staff = await this.buscarStaff(usuario.id);
    if (this.siguientePasoStaff(staff) !== 'configurar_2fa') throw new BadRequestException('Este paso no corresponde');
    const sesion = await this.prisma.sesion.findUniqueOrThrow({ where: { id: usuario.sesionId } });
    if (!sesion.secretoPendiente) throw new BadRequestException('Primero generá el código QR');
    const secreto = descifrar(sesion.secretoPendiente);
    this.comprobarCodigo(staff.id, secreto, codigo);
    await this.prisma.usuario.update({ where: { id: staff.id }, data: { dosFactoresSecreto: sesion.secretoPendiente } });
    await this.auditoria.registrar({ actorId: staff.id, accion: 'staff.2fa_activado', entidad: 'usuario', entidadId: staff.id, ip });
  }

  async verificar2fa(usuario: UsuarioAutenticado, codigo: string, ip?: string): Promise<void> {
    const staff = await this.buscarStaff(usuario.id);
    if (this.siguientePasoStaff(staff) !== 'verificar_2fa' || !staff.dosFactoresSecreto) {
      throw new BadRequestException('Este paso no corresponde');
    }
    this.comprobarCodigo(staff.id, descifrar(staff.dosFactoresSecreto), codigo);
    await this.auditoria.registrar({ actorId: staff.id, accion: 'staff.2fa_verificado', entidad: 'usuario', entidadId: staff.id, ip });
  }

  private comprobarCodigo(usuarioId: string, secreto: string, codigo: string): void {
    const claveLimite = `2fa:${usuarioId}`;
    this.limitador.verificar(claveLimite);
    if (!verificarCodigo(secreto, codigo)) {
      this.limitador.registrarFallo(claveLimite);
      throw new BadRequestException('El código no es correcto. Fijate la hora del celular y probá con el siguiente.');
    }
    this.limitador.limpiar(claveLimite);
  }

  async perfilStaff(id: string) {
    const staff = await this.prisma.usuario.findUniqueOrThrow({
      where: { id },
      include: INCLUIR_PERMISOS,
    });
    const permisos = permisosDe(staff);
    return {
      id: staff.id,
      nombreUsuario: staff.nombreUsuario,
      nombreVisible: staff.nombreVisible,
      perfil: staff.perfil ? { id: staff.perfil.id, nombre: staff.perfil.nombre } : null,
      permisos: [...permisos].sort(),
    };
  }
}
