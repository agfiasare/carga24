import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { calcularCarga, formatearPesos, MOTIVOS_RECHAZO, siguienteEstado, type AccionPedido, type MotivoRechazo } from '@carga24/shared';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { normalizarTelefono } from '../comun/telefono.js';
import { ConfiguracionService } from '../configuracion/configuracion.service.js';
import type { EstadoPedido, MedioPago, Prisma, TipoComprobante } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AlmacenArchivos } from './archivos.js';
import { EventosPedidos } from './eventos.service.js';

const nombre = { select: { id: true, nombreVisible: true, nombreUsuario: true } } as const;

export const INCLUIR_PEDIDO = {
  jugador: { select: { id: true, nombreUsuario: true, telefono: true, usuarioPlataforma: true } },
  plataforma: { select: { id: true, nombre: true } },
  cuenta: { select: { id: true, cbuCvu: true, alias: true, banco: true, titular: true, estado: true } },
  tomadoPor: nombre,
  verificadoPor: nombre,
  ejecutadoPor: nombre,
  comprobantes: { select: { id: true, tipo: true, mime: true, tamanoBytes: true, creadoEn: true }, orderBy: { creadoEn: 'asc' } },
} as const satisfies Prisma.PedidoInclude;

type PedidoCompleto = Prisma.PedidoGetPayload<{ include: typeof INCLUIR_PEDIDO }>;

const persona = (p: { id: string; nombreVisible: string | null; nombreUsuario: string | null } | null) =>
  p ? { id: p.id, nombre: p.nombreVisible ?? p.nombreUsuario ?? '' } : null;

export interface DatosNuevoPedido {
  tipo: 'carga' | 'retiro';
  jugadorId?: string;
  telefono?: string;
  plataformaId: string;
  /** Carga con recargo: lo que se acredita. Carga con descuento: lo que transfiere. Retiro: lo que se transfiere. */
  monto: number;
  medioPago: MedioPago;
  cuentaId?: string;
  nota?: string;
}

export interface OpcionesAlta {
  canal?: 'manual' | 'web';
  /** Comprobante ya guardado en disco, que se asocia al pedido en la misma transacción. */
  comprobante?: { clave: string; mime: string; tamanoBytes: number };
}

/** Aviso que recibe el jugador cuando su pedido se cierra. */
export function avisoParaJugador(id: number, tipo: 'carga' | 'retiro', estado: EstadoPedido, monto: number, motivo?: string): { titulo: string; texto: string } | null {
  if (estado === 'acreditado') return { titulo: `Tu carga #${id} fue acreditada`, texto: `Ya tenés ${formatearPesos(monto)} en tu usuario de la plataforma.` };
  if (estado === 'pagado') return { titulo: `Tu retiro #${id} fue pagado`, texto: `Te transferimos ${formatearPesos(monto)}.` };
  if (estado === 'rechazado') return { titulo: `Tu ${tipo} #${id} fue rechazado`, texto: motivo ?? 'Escribinos por WhatsApp si tenés dudas.' };
  return null;
}

export interface OpcionesTransicion {
  referenciaMovimiento?: string;
  motivo?: MotivoRechazo;
  detalle?: string;
}

/** Zona horaria del negocio: "cerrados hoy" es el día en Argentina. */
export function inicioDelDia(ahora = new Date()): Date {
  const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(ahora);
  return new Date(`${fecha}T00:00:00-03:00`);
}

@Injectable()
export class PedidosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly configuracion: ConfiguracionService,
    private readonly eventos: EventosPedidos,
    private readonly archivos: AlmacenArchivos,
  ) {}

  async parametros() {
    const [parametros, plataformas] = await Promise.all([
      this.configuracion.parametrosPedidos(),
      this.prisma.plataforma.findMany({ where: { activa: true }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } }),
    ]);
    return { ...parametros, plataformas };
  }

  /** Pedidos abiertos y los que se cerraron hoy. */
  async cola() {
    const pedidos = await this.prisma.pedido.findMany({
      where: {
        OR: [
          { estado: { in: ['pendiente', 'en_proceso', 'espera_aprobacion', 'verificado'] } },
          { estado: { in: ['acreditado', 'pagado', 'rechazado'] }, actualizadoEn: { gte: inicioDelDia() } },
        ],
      },
      include: INCLUIR_PEDIDO,
      orderBy: { creadoEn: 'asc' },
      take: 500,
    });
    const { montos } = await this.configuracion.parametrosPedidos();
    return pedidos.map((p) => this.presentar(p, montos.retiroConAprobacionDesde));
  }

  async obtener(id: number) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      include: {
        ...INCLUIR_PEDIDO,
        eventos: { orderBy: { creadoEn: 'asc' }, select: { id: true, de: true, a: true, nota: true, creadoEn: true, actorId: true } },
      },
    });
    if (!pedido) throw new NotFoundException(`No existe el pedido #${id}`);
    const actores = await this.prisma.usuario.findMany({
      where: { id: { in: pedido.eventos.flatMap((e) => (e.actorId ? [e.actorId] : [])) } },
      select: { id: true, nombreVisible: true, nombreUsuario: true, tipo: true },
    });
    const { montos } = await this.configuracion.parametrosPedidos();
    return {
      ...this.presentar(pedido, montos.retiroConAprobacionDesde),
      eventos: pedido.eventos.map(({ actorId, ...e }) => {
        const actor = actores.find((a) => a.id === actorId);
        return { ...e, actor: actor ? { id: actor.id, nombre: actor.nombreVisible ?? actor.nombreUsuario ?? '', tipo: actor.tipo } : null };
      }),
    };
  }

  // ---------- Alta manual (pedidos que llegan por WhatsApp) ----------

  async crear(datos: DatosNuevoPedido, actor: UsuarioAutenticado, ip?: string, extra: OpcionesAlta = {}) {
    const parametros = await this.configuracion.parametrosPedidos();
    const plataforma = await this.prisma.plataforma.findFirst({ where: { id: datos.plataformaId, activa: true } });
    if (!plataforma) throw new BadRequestException('Elegí una plataforma activa');

    // Jugador: el elegido, o el dueño del teléfono si ya tiene cuenta.
    const telefono = datos.telefono ? normalizarTelefono(datos.telefono) : null;
    if (datos.telefono && !telefono) throw new BadRequestException('El teléfono no es válido');
    const jugador = datos.jugadorId
      ? await this.prisma.usuario.findFirst({ where: { id: datos.jugadorId, tipo: 'jugador' } })
      : telefono
        ? await this.prisma.usuario.findFirst({ where: { telefono, tipo: 'jugador' } })
        : null;
    if (datos.jugadorId && !jugador) throw new BadRequestException('Ese jugador no existe');
    if (!jugador && !telefono) throw new BadRequestException('Elegí un jugador o escribí un teléfono');
    if (jugador?.estado === 'bloqueado') throw new ConflictException('Ese jugador está bloqueado');

    // Cuenta: de origen (carga) o de destino (retiro). Siempre del mismo jugador.
    let cuentaId: string | null = null;
    if (datos.medioPago === 'cuenta_registrada') {
      if (!jugador || !datos.cuentaId) throw new BadRequestException('Elegí una cuenta del jugador');
      const cuenta = await this.prisma.cuentaBancaria.findFirst({ where: { id: datos.cuentaId, usuarioId: jugador.id } });
      if (!cuenta) throw new BadRequestException('Esa cuenta no es del jugador');
      if (cuenta.estado === 'rechazada') throw new BadRequestException('Esa cuenta fue rechazada');
      if (datos.tipo === 'retiro' && cuenta.estado !== 'verificada') {
        throw new BadRequestException('Los retiros van solo a cuentas verificadas');
      }
      cuentaId = cuenta.id;
    } else if (datos.tipo === 'retiro' && datos.medioPago === 'otra_cuenta') {
      throw new BadRequestException('Los retiros van solo a cuentas verificadas del jugador o en efectivo');
    }

    const { montos, comision } = parametros;
    let importes: { monto: number; montoPagado: number | null; ganancia: number; comisionPb: number };
    if (datos.tipo === 'carga') {
      if (datos.monto < montos.cargaMinima || datos.monto > montos.cargaMaxima) {
        throw new BadRequestException(`La carga tiene que ser de ${formatearPesos(montos.cargaMinima)} a ${formatearPesos(montos.cargaMaxima)}`);
      }
      const calculo = calcularCarga(datos.monto, comision.porcentajePb, comision.modo);
      importes = { monto: calculo.acreditado, montoPagado: calculo.pagado, ganancia: calculo.ganancia, comisionPb: comision.porcentajePb };
    } else {
      if (datos.monto < montos.retiroMinimo) throw new BadRequestException(`El retiro mínimo es de ${formatearPesos(montos.retiroMinimo)}`);
      // La comisión de los retiros todavía no está definida: por ahora no se cobra.
      importes = { monto: datos.monto, montoPagado: null, ganancia: 0, comisionPb: 0 };
    }

    const canal = extra.canal ?? 'manual';
    const pedido = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.pedido.create({
        data: {
          tipo: datos.tipo,
          canal,
          medioPago: datos.medioPago,
          jugadorId: jugador?.id ?? null,
          telefono: jugador?.telefono ?? telefono,
          plataformaId: plataforma.id,
          cuentaId,
          modoComision: comision.modo,
          ...importes,
        },
      });
      const notaInicial = canal === 'web' ? 'Pedido desde la web' : 'Registrado desde el panel';
      await tx.eventoPedido.create({ data: { pedidoId: creado.id, a: 'pendiente', actorId: actor.id, nota: datos.nota?.trim() || notaInicial } });
      if (extra.comprobante) {
        await tx.comprobante.create({
          data: { pedidoId: creado.id, tipo: 'pago', claveAlmacenamiento: extra.comprobante.clave, mime: extra.comprobante.mime, tamanoBytes: extra.comprobante.tamanoBytes, subidoPorId: actor.id },
        });
      }
      await this.auditoria.registrar({ actorId: actor.id, accion: 'pedido.crear', entidad: 'pedido', entidadId: String(creado.id), datos: { tipo: datos.tipo, monto: importes.monto }, ip }, tx);
      return creado;
    });
    this.eventos.emitir({ tipo: 'pedido.creado', pedidoId: pedido.id, estado: pedido.estado, actorId: actor.id, jugadorId: pedido.jugadorId });
    return this.obtener(pedido.id);
  }

  // ---------- Cambios de estado ----------

  /**
   * Aplica una acción de forma atómica: la actualización solo prospera si el pedido sigue
   * en el estado (y la versión) que se leyó. Si dos personas actúan a la vez, gana una
   * y la otra recibe un 409 con lo que pasó.
   */
  async accionar(id: number, accion: AccionPedido, actor: UsuarioAutenticado, opciones: OpcionesTransicion = {}, ip?: string) {
    const { montos } = await this.configuracion.parametrosPedidos();

    const destinoFinal = await this.prisma
      .$transaction(async (tx) => {
        const pedido = await tx.pedido.findUnique({ where: { id }, include: { tomadoPor: nombre, cuenta: true, comprobantes: true } });
        if (!pedido) throw new NotFoundException(`No existe el pedido #${id}`);

        // Validar un retiro grande lo manda a aprobación en lugar de a "por pagar".
        const accionReal: AccionPedido =
          accion === 'verificar' && pedido.tipo === 'retiro' && pedido.monto >= montos.retiroConAprobacionDesde ? 'enviar_a_aprobacion' : accion;
        const destino = siguienteEstado(pedido.tipo, pedido.estado, accionReal);
        if (!destino) throw new ConflictException(this.explicarEstado(pedido.id, pedido.estado, pedido.tomadoPor));

        const esDelActor = pedido.tomadoPorId === actor.id;
        const requiereSerQuienLoTomo = accion === 'liberar' || accion === 'verificar' || (accion === 'rechazar' && pedido.estado === 'en_proceso');
        if (requiereSerQuienLoTomo && !esDelActor) {
          throw new ForbiddenException(`Lo tomó ${persona(pedido.tomadoPor)?.nombre ?? 'otra persona'}: solo esa persona puede seguir con este pedido`);
        }

        const ahora = new Date();
        const datos: Prisma.PedidoUpdateManyMutationInput & { tomadoPorId?: string | null; verificadoPorId?: string; ejecutadoPorId?: string } = {};
        let nota: string | undefined;
        switch (accion) {
          case 'tomar':
            Object.assign(datos, { tomadoPorId: actor.id, tomadoEn: ahora });
            break;
          case 'liberar':
            Object.assign(datos, { tomadoPorId: null, tomadoEn: null });
            break;
          case 'verificar': {
            const referencia = opciones.referenciaMovimiento?.trim();
            if (pedido.tipo === 'carga' && pedido.medioPago !== 'efectivo' && !referencia) {
              throw new BadRequestException('Escribí el número de operación del banco');
            }
            if (referencia) {
              const usado = await tx.pedido.findFirst({ where: { referenciaMovimiento: referencia, id: { not: id } }, select: { id: true } });
              if (usado) throw new ConflictException(`Ese número de operación ya se usó en el pedido #${usado.id}`);
            }
            Object.assign(datos, { referenciaMovimiento: referencia || null, verificadoPorId: actor.id, verificadoEn: ahora });
            nota = referencia ? `Operación ${referencia}` : undefined;
            if (accionReal === 'enviar_a_aprobacion') nota = `${nota ? `${nota}. ` : ''}Supera el límite: espera aprobación`;
            break;
          }
          case 'acreditar':
          case 'pagar':
            if (accion === 'pagar' && pedido.medioPago !== 'efectivo' && !pedido.comprobantes.some((c) => c.tipo === 'retiro')) {
              throw new BadRequestException('Adjuntá el comprobante de la transferencia antes de marcarlo pagado');
            }
            Object.assign(datos, { ejecutadoPorId: actor.id, ejecutadoEn: ahora });
            break;
          case 'rechazar': {
            if (!opciones.motivo) throw new BadRequestException('Elegí un motivo');
            const detalle = opciones.detalle?.trim();
            datos.motivoRechazo = detalle ? `${MOTIVOS_RECHAZO[opciones.motivo]}: ${detalle}` : MOTIVOS_RECHAZO[opciones.motivo];
            nota = datos.motivoRechazo;
            break;
          }
        }

        const { count } = await tx.pedido.updateMany({
          where: { id, estado: pedido.estado, version: pedido.version, ...(accion === 'tomar' ? { tomadoPorId: null } : {}) },
          data: { ...datos, estado: destino, version: { increment: 1 } },
        });
        if (count === 0) {
          const actual = await tx.pedido.findUnique({ where: { id }, include: { tomadoPor: nombre } });
          throw new ConflictException(actual ? this.explicarEstado(id, actual.estado, actual.tomadoPor) : 'El pedido cambió. Actualizá la cola.');
        }

        // El primer pago confirmado desde una cuenta pendiente la verifica.
        if (accion === 'verificar' && pedido.tipo === 'carga' && pedido.cuenta?.estado === 'pendiente') {
          await tx.cuentaBancaria.update({ where: { id: pedido.cuenta.id }, data: { estado: 'verificada', verificadaConPedidoId: id } });
          nota = `${nota ? `${nota}. ` : ''}Cuenta verificada con este pago`;
        }

        await tx.eventoPedido.create({ data: { pedidoId: id, de: pedido.estado, a: destino, actorId: actor.id, nota } });
        const aviso = avisoParaJugador(pedido.id, pedido.tipo, destino, pedido.monto, datos.motivoRechazo as string | undefined);
        if (pedido.jugadorId && aviso) await tx.notificacion.create({ data: { usuarioId: pedido.jugadorId, pedidoId: id, ...aviso } });
        await this.auditoria.registrar(
          { actorId: actor.id, accion: `pedido.${accionReal}`, entidad: 'pedido', entidadId: String(id), datos: { de: pedido.estado, a: destino, ...(nota ? { nota } : {}) }, ip },
          tx,
        );
        return { destino, jugadorId: pedido.jugadorId };
      })
      .catch((error: unknown) => {
        if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Ese número de operación ya se usó en otro pedido');
        throw error;
      });
    // Se avisa recién con el cambio guardado, así quien recarga la cola ya lo ve.
    this.eventos.emitir({ tipo: 'pedido.actualizado', pedidoId: id, estado: destinoFinal.destino, actorId: actor.id, jugadorId: destinoFinal.jugadorId });
    return this.obtener(id);
  }

  private explicarEstado(id: number, estado: EstadoPedido, tomadoPor: { id: string; nombreVisible: string | null; nombreUsuario: string | null } | null): string {
    if (estado === 'en_proceso' && tomadoPor) return `El pedido #${id} ya lo tomó ${persona(tomadoPor)?.nombre}`;
    const textos: Record<EstadoPedido, string> = {
      pendiente: 'está pendiente',
      en_proceso: 'está en proceso',
      espera_aprobacion: 'espera aprobación',
      verificado: 'ya está verificado',
      acreditado: 'ya está acreditado',
      pagado: 'ya está pagado',
      rechazado: 'ya está rechazado',
    };
    return `El pedido #${id} ${textos[estado]}: actualizá la cola`;
  }

  // ---------- Comprobantes ----------

  async adjuntar(id: number, tipo: TipoComprobante, archivo: { buffer: Buffer; size: number }, actor: UsuarioAutenticado, ip?: string) {
    const pedido = await this.prisma.pedido.findUnique({ where: { id } });
    if (!pedido) throw new NotFoundException(`No existe el pedido #${id}`);
    if (['acreditado', 'pagado', 'rechazado'].includes(pedido.estado)) throw new ConflictException('El pedido ya está cerrado');
    if (tipo === 'retiro' && pedido.tipo !== 'retiro') throw new BadRequestException('El comprobante de retiro va solo en retiros');
    const { clave, mime } = await this.archivos.guardar(archivo.buffer);
    const comprobante = await this.prisma.comprobante.create({
      data: { pedidoId: id, tipo, claveAlmacenamiento: clave, mime, tamanoBytes: archivo.size, subidoPorId: actor.id },
      select: { id: true, tipo: true, mime: true, tamanoBytes: true, creadoEn: true },
    });
    await this.auditoria.registrar({ actorId: actor.id, accion: 'pedido.comprobante', entidad: 'pedido', entidadId: String(id), datos: { comprobanteId: comprobante.id, tipo }, ip });
    this.eventos.emitir({ tipo: 'pedido.actualizado', pedidoId: id, estado: pedido.estado, actorId: actor.id, jugadorId: pedido.jugadorId });
    return comprobante;
  }

  async archivoComprobante(comprobanteId: string) {
    const comprobante = await this.prisma.comprobante.findUnique({ where: { id: comprobanteId } });
    if (!comprobante) throw new NotFoundException('No existe ese comprobante');
    return { comprobante, flujo: this.archivos.leer(comprobante.claveAlmacenamiento) };
  }

  // ---------- Presentación ----------

  presentar(p: PedidoCompleto, limiteAprobacion: number) {
    return {
      id: p.id,
      tipo: p.tipo,
      estado: p.estado,
      canal: p.canal,
      medioPago: p.medioPago,
      monto: p.monto,
      montoPagado: p.montoPagado,
      ganancia: p.ganancia,
      comisionPb: p.comisionPb,
      modoComision: p.modoComision,
      referenciaMovimiento: p.referenciaMovimiento,
      motivoRechazo: p.motivoRechazo,
      telefono: p.telefono,
      jugador: p.jugador,
      plataforma: p.plataforma,
      cuenta: p.cuenta,
      tomadoPor: persona(p.tomadoPor),
      tomadoEn: p.tomadoEn,
      verificadoPor: persona(p.verificadoPor),
      verificadoEn: p.verificadoEn,
      ejecutadoPor: persona(p.ejecutadoPor),
      ejecutadoEn: p.ejecutadoEn,
      comprobantes: p.comprobantes,
      requiereAprobacion: p.tipo === 'retiro' && p.monto >= limiteAprobacion,
      creadoEn: p.creadoEn,
      actualizadoEn: p.actualizadoEn,
    };
  }
}
