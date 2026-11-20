import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import type { Permiso } from '@carga24/shared';
import { generarToken, hashToken } from '../comun/cripto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AmbitoSesion, NivelSesion } from '../generated/prisma/client.js';
import { INCLUIR_PERMISOS, permisosDe } from './permisos-usuario.js';
import type { Peticion, UsuarioAutenticado } from './usuario-autenticado.js';

/** Una cookie por ámbito: jugador y staff nunca comparten sesión. */
export const COOKIE: Record<AmbitoSesion, string> = { jugador: 'c24_jugador', staff: 'c24_staff' };

const MINUTO = 60 * 1000;
const DURACION: Record<AmbitoSesion | 'pendiente', number> = {
  jugador: 7 * 24 * 60 * MINUTO,
  staff: 12 * 60 * MINUTO,
  /** Tiempo para terminar el ingreso del staff (contraseña nueva y 2FA). */
  pendiente: 15 * MINUTO,
};

@Injectable()
export class SesionesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Crea la sesión, deja la cookie en la respuesta y devuelve el id. */
  async crear(
    usuarioId: string,
    ambito: AmbitoSesion,
    nivel: NivelSesion,
    peticion: Peticion,
    respuesta: Response,
  ): Promise<string> {
    const token = generarToken();
    const duracion = nivel === 'pendiente' ? DURACION.pendiente : DURACION[ambito];
    const sesion = await this.prisma.sesion.create({
      data: {
        usuarioId,
        ambito,
        nivel,
        tokenHash: hashToken(token),
        venceEn: new Date(Date.now() + duracion),
        ip: peticion.ip ?? null,
        dispositivo: peticion.get('user-agent')?.slice(0, 300) ?? null,
      },
    });
    respuesta.cookie(COOKIE[ambito], token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: duracion,
    });
    return sesion.id;
  }

  /**
   * Lee la cookie del ámbito y arma el usuario autenticado, o null si no hay
   * sesión válida (vencida, usuario bloqueado, etc.).
   */
  async autenticar(peticion: Peticion, ambito: AmbitoSesion): Promise<UsuarioAutenticado | null> {
    const token = (peticion.cookies as Record<string, string> | undefined)?.[COOKIE[ambito]];
    if (!token) return null;
    const sesion = await this.prisma.sesion.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { usuario: { include: INCLUIR_PERMISOS } },
    });
    if (!sesion || sesion.ambito !== ambito || sesion.venceEn <= new Date()) return null;
    const { usuario } = sesion;
    if (usuario.estado !== 'activo' || usuario.tipo !== ambito) return null;

    let permisos: ReadonlySet<Permiso> = new Set();
    if (usuario.tipo === 'staff' && sesion.nivel === 'completa') permisos = permisosDe(usuario);
    return {
      id: usuario.id,
      tipo: usuario.tipo,
      permisos,
      sesionId: sesion.id,
      nivel: sesion.nivel,
      debeCambiarContrasena: usuario.debeCambiarContrasena,
    };
  }

  async cerrar(sesionId: string, ambito: AmbitoSesion, respuesta: Response): Promise<void> {
    await this.prisma.sesion.deleteMany({ where: { id: sesionId } });
    this.borrarCookie(ambito, respuesta);
  }

  borrarCookie(ambito: AmbitoSesion, respuesta: Response): void {
    respuesta.clearCookie(COOKIE[ambito], { path: '/' });
  }

  /** Cierra todas las sesiones de un usuario (menos una, si se indica). */
  async cerrarTodas(usuarioId: string, excepto?: string): Promise<void> {
    await this.prisma.sesion.deleteMany({ where: { usuarioId, ...(excepto ? { id: { not: excepto } } : {}) } });
  }

  async limpiarVencidas(): Promise<void> {
    await this.prisma.sesion.deleteMany({ where: { venceEn: { lte: new Date() } } });
  }
}
