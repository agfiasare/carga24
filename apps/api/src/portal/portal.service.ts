import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { ConfiguracionService } from '../configuracion/configuracion.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AlmacenArchivos } from '../pedidos/archivos.js';
import { INCLUIR_PEDIDO, PedidosService } from '../pedidos/pedidos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const ABIERTOS = ['pendiente', 'en_proceso', 'espera_aprobacion', 'verificado'] as const;
const POR_PAGINA = 20;

export interface DatosCuenta {
  cbuCvu: string;
  alias?: string;
  banco?: string;
  titular?: string;
}

export interface DatosPedidoWeb {
  tipo: 'carga' | 'retiro';
  monto: number;
  cuentaId: string;
  codigoPromo?: string;
}

type PedidoCompleto = Prisma.PedidoGetPayload<{ include: typeof INCLUIR_PEDIDO }>;

/** Lo que ve el jugador de su pedido: sin nombres del staff ni datos internos. */
export function pedidoParaJugador(p: PedidoCompleto) {
  return {
    id: p.id,
    tipo: p.tipo,
    estado: p.estado,
    canal: p.canal,
    medioPago: p.medioPago,
    monto: p.monto,
    montoPagado: p.montoPagado,
    comision: p.ganancia,
    comisionPb: p.comisionPb,
    modoComision: p.modoComision,
    motivoRechazo: p.motivoRechazo,
    cuenta: p.cuenta ? { id: p.cuenta.id, cbuCvu: p.cuenta.cbuCvu, alias: p.cuenta.alias, estado: p.cuenta.estado } : null,
    plataforma: p.plataforma,
    comprobantes: p.comprobantes,
    promo: p.promocion,
    creadoEn: p.creadoEn,
    actualizadoEn: p.actualizadoEn,
  };
}

/** Todo lo que el jugador hace desde la web, siempre limitado a lo suyo. */
@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configuracion: ConfiguracionService,
    private readonly pedidos: PedidosService,
    private readonly archivos: AlmacenArchivos,
    private readonly auditoria: AuditoriaService,
  ) {}

  async parametros() {
    const [parametros, pago, plataforma] = await Promise.all([
      this.configuracion.parametrosPedidos(),
      this.prisma.configuracion.findMany({ where: { clave: { in: ['pago.alias', 'pago.titular', 'pago.banco', 'atencion.horario', 'atencion.whatsapp'] } } }),
      this.prisma.plataforma.findFirst({ where: { activa: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
    ]);
    const valor = (clave: string) => {
      const v = pago.find((f) => f.clave === clave)?.valor;
      return typeof v === 'string' ? v : '';
    };
    return {
      comision: parametros.comision,
      montos: parametros.montos,
      cuentasPendientesMaximas: parametros.cuentasPendientesMaximas,
      datosPago: { alias: valor('pago.alias'), titular: valor('pago.titular'), banco: valor('pago.banco') },
      horario: valor('atencion.horario'),
      whatsapp: valor('atencion.whatsapp'),
      plataforma,
    };
  }

  // ---------- Cuentas ----------

  cuentas(jugadorId: string) {
    return this.prisma.cuentaBancaria.findMany({
      where: { usuarioId: jugadorId },
      select: { id: true, cbuCvu: true, alias: true, banco: true, titular: true, estado: true, creadoEn: true },
      orderBy: { creadoEn: 'asc' },
    });
  }

  /** Cuentas ilimitadas, pero como mucho N pendientes: cada una se verifica con el primer pago confirmado desde ella. */
  async agregarCuenta(jugador: UsuarioAutenticado, datos: DatosCuenta, ip?: string) {
    const { cuentasPendientesMaximas } = await this.configuracion.parametrosPedidos();
    const existente = await this.prisma.cuentaBancaria.findUnique({ where: { cbuCvu: datos.cbuCvu } });
    if (existente) {
      throw new ConflictException(existente.usuarioId === jugador.id ? 'Esa cuenta ya la tenés cargada' : 'Esa cuenta ya está registrada por otro jugador. Escribinos por WhatsApp.');
    }
    const pendientes = await this.prisma.cuentaBancaria.count({ where: { usuarioId: jugador.id, estado: 'pendiente' } });
    if (pendientes >= cuentasPendientesMaximas) {
      throw new ConflictException(`Ya tenés ${pendientes} cuentas sin verificar. Se verifican con tu primer pago desde cada una.`);
    }
    const cuenta = await this.prisma.cuentaBancaria
      .create({
        data: { usuarioId: jugador.id, cbuCvu: datos.cbuCvu, alias: datos.alias || null, banco: datos.banco || null, titular: datos.titular || null },
        select: { id: true, cbuCvu: true, alias: true, banco: true, titular: true, estado: true, creadoEn: true },
      })
      .catch((e: unknown) => {
        if ((e as { code?: string }).code === 'P2002') throw new ConflictException('Esa cuenta ya está registrada');
        throw e;
      });
    await this.auditoria.registrar({ actorId: jugador.id, accion: 'cuenta.agregar', entidad: 'cuenta', entidadId: cuenta.id, ip });
    return cuenta;
  }

  /** Solo se puede quitar una cuenta que todavía no se usó en ningún pedido. */
  async quitarCuenta(jugadorId: string, cuentaId: string) {
    const cuenta = await this.prisma.cuentaBancaria.findFirst({ where: { id: cuentaId, usuarioId: jugadorId }, include: { _count: { select: { pedidos: true } } } });
    if (!cuenta) throw new NotFoundException('No encontramos esa cuenta');
    if (cuenta._count.pedidos > 0) throw new ConflictException('Esa cuenta ya se usó en pedidos: no se puede quitar');
    await this.prisma.cuentaBancaria.delete({ where: { id: cuentaId } });
  }

  // ---------- Pedidos ----------

  async crearPedido(jugador: UsuarioAutenticado, datos: DatosPedidoWeb, archivo: { buffer: Buffer; size: number } | undefined, ip?: string) {
    const abierto = await this.prisma.pedido.findFirst({ where: { jugadorId: jugador.id, estado: { in: [...ABIERTOS] } }, select: { id: true } });
    if (abierto) throw new ConflictException(`Ya tenés un pedido en curso (#${abierto.id}). Esperá a que termine para hacer otro.`);
    // Desde una cuenta ya verificada el comprobante es opcional: el pago se busca en el banco.
    // La primera vez desde una cuenta nueva sí hace falta, porque ese pago es el que la verifica.
    if (datos.tipo === 'carga' && !archivo) {
      const cuenta = await this.prisma.cuentaBancaria.findFirst({ where: { id: datos.cuentaId, usuarioId: jugador.id }, select: { estado: true } });
      if (cuenta?.estado !== 'verificada') throw new BadRequestException('Adjuntá el comprobante: es tu primer pago desde esta cuenta');
    }
    const plataforma = await this.prisma.plataforma.findFirst({ where: { activa: true }, orderBy: { nombre: 'asc' } });
    if (!plataforma) throw new ConflictException('Por ahora no estamos tomando pedidos. Escribinos por WhatsApp.');

    const guardado = archivo && datos.tipo === 'carga' ? await this.archivos.guardar(archivo.buffer) : null;
    try {
      const pedido = await this.pedidos.crear(
        { tipo: datos.tipo, jugadorId: jugador.id, plataformaId: plataforma.id, monto: datos.monto, medioPago: 'cuenta_registrada', cuentaId: datos.cuentaId, codigoPromo: datos.codigoPromo },
        jugador,
        ip,
        { canal: 'web', ...(guardado ? { comprobante: { ...guardado, tamanoBytes: archivo!.size } } : {}) },
      );
      return this.miPedido(jugador.id, pedido.id);
    } catch (error) {
      if (guardado) await this.archivos.borrar(guardado.clave);
      throw error;
    }
  }

  async misPedidos(jugadorId: string, filtro: { estado?: 'en_curso' | 'cerrados'; tipo?: 'carga' | 'retiro'; pagina: number }) {
    const where: Prisma.PedidoWhereInput = {
      jugadorId,
      ...(filtro.tipo ? { tipo: filtro.tipo } : {}),
      ...(filtro.estado === 'en_curso' ? { estado: { in: [...ABIERTOS] } } : filtro.estado === 'cerrados' ? { estado: { notIn: [...ABIERTOS] } } : {}),
    };
    const [total, pedidos] = await Promise.all([
      this.prisma.pedido.count({ where }),
      this.prisma.pedido.findMany({ where, include: INCLUIR_PEDIDO, orderBy: { creadoEn: 'desc' }, skip: (filtro.pagina - 1) * POR_PAGINA, take: POR_PAGINA }),
    ]);
    return { total, pagina: filtro.pagina, porPagina: POR_PAGINA, pedidos: pedidos.map(pedidoParaJugador) };
  }

  async miPedido(jugadorId: string, id: number) {
    const pedido = await this.prisma.pedido.findFirst({
      where: { id, jugadorId },
      include: { ...INCLUIR_PEDIDO, eventos: { orderBy: { creadoEn: 'asc' }, select: { a: true, creadoEn: true } } },
    });
    if (!pedido) throw new NotFoundException('No encontramos ese pedido');
    return { ...pedidoParaJugador(pedido), historial: pedido.eventos };
  }

  async adjuntar(jugador: UsuarioAutenticado, id: number, archivo: { buffer: Buffer; size: number }, ip?: string) {
    await this.miPedido(jugador.id, id);
    return this.pedidos.adjuntar(id, 'pago', archivo, jugador, ip);
  }

  async comprobante(jugadorId: string, comprobanteId: string) {
    const resultado = await this.pedidos.archivoComprobante(comprobanteId);
    const pedido = await this.prisma.pedido.findFirst({ where: { id: resultado.comprobante.pedidoId, jugadorId }, select: { id: true } });
    if (!pedido) {
      resultado.flujo.destroy();
      throw new NotFoundException('No existe ese comprobante');
    }
    return resultado;
  }

  // ---------- Avisos y novedades ----------

  async notificaciones(jugadorId: string) {
    const [noLeidas, avisos] = await Promise.all([
      this.prisma.notificacion.count({ where: { usuarioId: jugadorId, leidaEn: null } }),
      this.prisma.notificacion.findMany({
        where: { usuarioId: jugadorId },
        select: { id: true, titulo: true, texto: true, pedidoId: true, leidaEn: true, creadoEn: true },
        orderBy: { creadoEn: 'desc' },
        take: 50,
      }),
    ]);
    return { noLeidas, avisos };
  }

  async marcarLeidas(jugadorId: string, ids?: string[]) {
    await this.prisma.notificacion.updateMany({
      where: { usuarioId: jugadorId, leidaEn: null, ...(ids ? { id: { in: ids } } : {}) },
      data: { leidaEn: new Date() },
    });
    return this.notificaciones(jugadorId);
  }

  novedades() {
    return this.prisma.novedad.findMany({
      where: { publicadaEn: { not: null } },
      select: { id: true, titulo: true, texto: true, fijada: true, publicadaEn: true },
      orderBy: [{ fijada: 'desc' }, { publicadaEn: 'desc' }],
      take: 30,
    });
  }
}
