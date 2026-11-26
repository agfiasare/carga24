import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { formatearPesos } from '@carga24/shared';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import type { Prisma } from '../generated/prisma/client.js';
import { EventosPedidos } from '../pedidos/eventos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { balance, inicioDeSemana, saldoCaja, type Balance } from './balance.js';
import { bloquearCaja, turnoAbiertoDe } from './candado.js';
import type { DatosAjuste, DatosCierre, DatosLiquidacion, DatosRendicion } from './esquemas.js';

type Tx = Prisma.TransactionClient;

const nombreDe = (u: { nombreVisible: string | null; nombreUsuario: string | null } | null) => (u ? (u.nombreVisible ?? u.nombreUsuario ?? '') : null);
const PERSONA = { select: { id: true, nombreVisible: true, nombreUsuario: true } } as const;

type TurnoConPersonas = Prisma.TurnoGetPayload<{ include: { usuario: typeof PERSONA; cerradoPor: typeof PERSONA } }>;

@Injectable()
export class CajaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly eventos: EventosPedidos,
  ) {}

  private presentarTurno(t: TurnoConPersonas, b: Balance) {
    return {
      id: t.id,
      usuario: { id: t.usuario.id, nombre: nombreDe(t.usuario) },
      abiertoEn: t.abiertoEn,
      cerradoEn: t.cerradoEn,
      cerradoPor: t.cerradoPor ? { id: t.cerradoPor.id, nombre: nombreDe(t.cerradoPor) } : null,
      cajaAlAbrir: t.cajaAlAbrir,
      cajaAlCerrar: t.cajaAlCerrar,
      saldoInformado: t.saldoInformado,
      nota: t.nota,
      ...b,
    };
  }

  /** Balance de un turno: el congelado si está cerrado, el de este momento si sigue abierto. */
  private async conBalance(t: TurnoConPersonas) {
    const b: Balance = t.cerradoEn
      ? { cantidadCargas: t.cantidadCargas, cantidadRetiros: t.cantidadRetiros, ingresos: t.ingresos, comision: t.comision, cargasNetas: t.cargasNetas, premios: t.premios, resultado: t.resultado }
      : await balance(this.prisma, { turnoId: t.id });
    return this.presentarTurno(t, b);
  }

  // ---------- Turnos ----------

  /** Lo que necesita la cola: mi turno abierto, el saldo de la caja y el último cierre. */
  async actual(actor: UsuarioAutenticado) {
    const [turno, caja, ultimo] = await Promise.all([
      this.prisma.turno.findFirst({ where: { usuarioId: actor.id, cerradoEn: null }, include: { usuario: PERSONA, cerradoPor: PERSONA } }),
      saldoCaja(this.prisma),
      this.prisma.turno.findFirst({ where: { cerradoEn: { not: null } }, orderBy: { cerradoEn: 'desc' }, include: { usuario: PERSONA } }),
    ]);
    return {
      turno: turno ? await this.conBalance(turno) : null,
      caja,
      ultimoCierre: ultimo ? { usuario: nombreDe(ultimo.usuario), cerradoEn: ultimo.cerradoEn } : null,
    };
  }

  async abrir(actor: UsuarioAutenticado, ip?: string) {
    try {
      await this.prisma.$transaction(async (tx) => {
        if (await turnoAbiertoDe(tx, actor.id)) throw new ConflictException('Ya tenés un turno abierto');
        const turno = await tx.turno.create({ data: { usuarioId: actor.id, cajaAlAbrir: await saldoCaja(tx) } });
        await this.auditoria.registrar({ actorId: actor.id, accion: 'turno.abrir', entidad: 'turno', entidadId: turno.id, ip }, tx);
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Ya tenés un turno abierto');
      throw error;
    }
    return this.actual(actor);
  }

  private puedeVer(turno: { usuarioId: string }, actor: UsuarioAutenticado): boolean {
    return turno.usuarioId === actor.id || actor.permisos.has('caja.ver') || actor.permisos.has('turnos.cerrar_ajenos');
  }

  /** Detalle para cerrar o revisar un turno, con los pedidos que quedaron a mitad de camino. */
  async resumen(id: string, actor: UsuarioAutenticado) {
    const turno = await this.prisma.turno.findUnique({ where: { id }, include: { usuario: PERSONA, cerradoPor: PERSONA } });
    if (!turno || !this.puedeVer(turno, actor)) throw new NotFoundException('No existe ese turno');
    const [presentado, tomados, abiertos, caja] = await Promise.all([
      this.conBalance(turno),
      turno.cerradoEn
        ? Promise.resolve([])
        : this.prisma.pedido.findMany({ where: { estado: 'en_proceso', tomadoPorId: turno.usuarioId }, select: { id: true, tipo: true, monto: true }, orderBy: { id: 'asc' } }),
      this.prisma.pedido.count({ where: { estado: { in: ['pendiente', 'en_proceso', 'espera_aprobacion', 'verificado'] } } }),
      saldoCaja(this.prisma),
    ]);
    return {
      ...presentado,
      // Si se cerrara ahora: la caja actual más el resultado del turno.
      cajaAlCerrar: turno.cerradoEn ? turno.cajaAlCerrar : caja + presentado.resultado,
      cajaAntes: turno.cerradoEn ? (turno.cajaAlCerrar ?? 0) - turno.resultado : caja,
      tomados,
      pedidosAbiertos: abiertos,
    };
  }

  async listarTurnos() {
    const turnos = await this.prisma.turno.findMany({ include: { usuario: PERSONA, cerradoPor: PERSONA }, orderBy: { abiertoEn: 'desc' }, take: 100 });
    return Promise.all(turnos.map((t) => this.conBalance(t)));
  }

  /**
   * Cierra el turno: libera los pedidos que la persona dejó tomados, congela el balance
   * y suma el resultado a la caja. Un turno cerrado no se modifica más.
   */
  async cerrar(id: string, datos: DatosCierre, actor: UsuarioAutenticado, ip?: string) {
    const liberados = await this.prisma.$transaction(async (tx) => {
      await bloquearCaja(tx);
      const turno = await tx.turno.findUnique({ where: { id } });
      if (!turno || !this.puedeVer(turno, actor)) throw new NotFoundException('No existe ese turno');
      if (turno.usuarioId !== actor.id && !actor.permisos.has('turnos.cerrar_ajenos')) throw new ForbiddenException('Te falta el permiso: turnos.cerrar_ajenos');
      if (turno.cerradoEn) throw new ConflictException('Ese turno ya está cerrado');

      const tomados = await tx.pedido.findMany({ where: { estado: 'en_proceso', tomadoPorId: turno.usuarioId }, select: { id: true, version: true, jugadorId: true } });
      for (const p of tomados) {
        const { count } = await tx.pedido.updateMany({
          where: { id: p.id, estado: 'en_proceso', version: p.version },
          data: { estado: 'pendiente', tomadoPorId: null, tomadoEn: null, version: { increment: 1 } },
        });
        if (count === 1) await tx.eventoPedido.create({ data: { pedidoId: p.id, de: 'en_proceso', a: 'pendiente', actorId: actor.id, nota: 'Liberado al cerrar el turno' } });
      }

      const b = await balance(tx, { turnoId: id });
      const cajaAlCerrar = (await saldoCaja(tx)) + b.resultado;
      const ahora = new Date();
      const { count } = await tx.turno.updateMany({
        where: { id, cerradoEn: null },
        data: { ...b, cerradoEn: ahora, cerradoPorId: actor.id, cajaAlCerrar, saldoInformado: datos.saldoInformado ?? null, nota: datos.nota || null },
      });
      if (count === 0) throw new ConflictException('Ese turno ya está cerrado');
      await tx.movimientoCaja.create({ data: { tipo: 'cierre_turno', monto: b.resultado, saldoPosterior: cajaAlCerrar, turnoId: id, creadoPorId: actor.id, creadoEn: ahora } });
      await this.auditoria.registrar(
        { actorId: actor.id, accion: 'turno.cerrar', entidad: 'turno', entidadId: id, datos: { ...b, cajaAlCerrar, ...(datos.saldoInformado !== undefined ? { saldoInformado: datos.saldoInformado } : {}) }, ip },
        tx,
      );
      return tomados;
    });
    for (const p of liberados) this.eventos.emitir({ tipo: 'pedido.actualizado', pedidoId: p.id, estado: 'pendiente', actorId: actor.id, jugadorId: p.jugadorId });
    return this.resumen(id, actor);
  }

  // ---------- Caja ----------

  async caja() {
    const ultimaLiquidacion = await this.prisma.movimientoCaja.findFirst({ where: { tipo: 'liquidacion' }, orderBy: { creadoEn: 'desc' } });
    const [saldo, abiertos, sinLiquidar, semana, movimientos] = await Promise.all([
      saldoCaja(this.prisma),
      this.prisma.turno.findMany({ where: { cerradoEn: null }, include: { usuario: PERSONA, cerradoPor: PERSONA }, orderBy: { abiertoEn: 'asc' } }),
      this.prisma.turno.findMany({
        where: { cerradoEn: ultimaLiquidacion ? { gt: ultimaLiquidacion.creadoEn } : { not: null } },
        include: { usuario: PERSONA, cerradoPor: PERSONA },
        orderBy: { cerradoEn: 'asc' },
      }),
      this.prisma.pedido.aggregate({ where: { estado: { in: ['acreditado', 'pagado'] }, ejecutadoEn: { gte: inicioDeSemana() } }, _sum: { ganancia: true } }),
      this.prisma.movimientoCaja.findMany({ include: { creadoPor: PERSONA, turno: { include: { usuario: PERSONA } } }, orderBy: { creadoEn: 'desc' }, take: 50 }),
    ]);
    return {
      saldo,
      ultimaLiquidacion: ultimaLiquidacion?.creadoEn ?? null,
      gananciaSemana: semana._sum.ganancia ?? 0,
      turnosAbiertos: await Promise.all(abiertos.map((t) => this.conBalance(t))),
      turnosSinLiquidar: await Promise.all(sinLiquidar.map((t) => this.conBalance(t))),
      movimientos: movimientos.map((m) => ({
        id: m.id,
        tipo: m.tipo,
        monto: m.monto,
        saldoPosterior: m.saldoPosterior,
        nota: m.nota,
        creadoEn: m.creadoEn,
        creadoPor: nombreDe(m.creadoPor),
        turno: m.turno ? { id: m.turno.id, usuario: nombreDe(m.turno.usuario), abiertoEn: m.turno.abiertoEn, cerradoEn: m.turno.cerradoEn } : null,
      })),
    };
  }

  /** Registra lo que se sacó de la caja (todo el saldo o una parte). */
  async liquidar(datos: DatosLiquidacion, actor: UsuarioAutenticado, ip?: string) {
    await this.prisma.$transaction(async (tx) => {
      await bloquearCaja(tx);
      const saldo = await saldoCaja(tx);
      if (saldo <= 0) throw new ConflictException('No hay saldo para liquidar');
      if (datos.monto > saldo) throw new BadRequestException(`No podés liquidar más que el saldo de la caja (${formatearPesos(saldo)})`);
      const movimiento = await tx.movimientoCaja.create({ data: { tipo: 'liquidacion', monto: -datos.monto, saldoPosterior: saldo - datos.monto, nota: datos.nota || null, creadoPorId: actor.id } });
      await this.auditoria.registrar({ actorId: actor.id, accion: 'caja.liquidar', entidad: 'caja', entidadId: movimiento.id, datos: { monto: datos.monto, saldoAnterior: saldo }, ip }, tx);
    });
    return this.caja();
  }

  /** Corrige la caja (un error en un turno cerrado, un gasto, un aporte). Siempre con motivo. */
  async ajustar(datos: DatosAjuste, actor: UsuarioAutenticado, ip?: string) {
    await this.prisma.$transaction(async (tx) => {
      await bloquearCaja(tx);
      const saldo = await saldoCaja(tx);
      const movimiento = await tx.movimientoCaja.create({ data: { tipo: 'ajuste', monto: datos.monto, saldoPosterior: saldo + datos.monto, nota: datos.nota, creadoPorId: actor.id } });
      await this.auditoria.registrar({ actorId: actor.id, accion: 'caja.ajustar', entidad: 'caja', entidadId: movimiento.id, datos: { monto: datos.monto, nota: datos.nota, saldoAnterior: saldo }, ip }, tx);
    });
    return this.caja();
  }

  // ---------- Rendiciones ----------

  /** Lo que corresponde rendir desde la última rendición: cargas netas − premios + lo que quedó pendiente. */
  private async pendiente(tx: Pick<Tx, 'rendicion' | 'pedido'>, hasta: Date) {
    const ultima = await tx.rendicion.findFirst({ orderBy: { creadoEn: 'desc' } });
    const desde = ultima?.hasta ?? null;
    const b = await balance(tx, { ejecutadoEn: { ...(desde ? { gt: desde } : {}), lte: hasta } });
    const arrastre = ultima ? ultima.correspondia - ultima.rendido : 0;
    return { desde, hasta, cargasNetas: b.cargasNetas, premios: b.premios, comision: b.comision, cantidadPedidos: b.cantidadCargas + b.cantidadRetiros, arrastre, correspondia: b.cargasNetas - b.premios + arrastre };
  }

  async rendiciones() {
    const [pendiente, historial] = await Promise.all([
      this.pendiente(this.prisma, new Date()),
      this.prisma.rendicion.findMany({ include: { creadoPor: PERSONA }, orderBy: { creadoEn: 'desc' }, take: 50 }),
    ]);
    return { pendiente, historial: historial.map(({ creadoPor, creadoPorId: _c, ...r }) => ({ ...r, creadoPor: nombreDe(creadoPor) })) };
  }

  async rendir(datos: DatosRendicion, actor: UsuarioAutenticado, ip?: string) {
    await this.prisma.$transaction(async (tx) => {
      await bloquearCaja(tx);
      const p = await this.pendiente(tx, new Date());
      const rendicion = await tx.rendicion.create({
        data: { desde: p.desde ?? new Date(0), hasta: p.hasta, cargasNetas: p.cargasNetas, premios: p.premios, arrastre: p.arrastre, correspondia: p.correspondia, rendido: datos.monto, nota: datos.nota || null, creadoPorId: actor.id },
      });
      await this.auditoria.registrar({ actorId: actor.id, accion: 'rendicion.registrar', entidad: 'rendicion', entidadId: rendicion.id, datos: { correspondia: p.correspondia, rendido: datos.monto }, ip }, tx);
    });
    return this.rendiciones();
  }
}
