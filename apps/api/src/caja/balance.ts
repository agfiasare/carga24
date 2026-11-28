import type { Prisma } from '../generated/prisma/client.js';
import { fechaArgentina, inicioDeFecha } from '../reportes/fechas.js';

type Tx = Prisma.TransactionClient;

export interface Balance {
  cantidadCargas: number;
  cantidadRetiros: number;
  /** Lo que transfirieron los jugadores. */
  ingresos: number;
  /** Ganancia: comisión de las cargas (sobre el neto de impuesto) + comisión de retiros. */
  comision: number;
  /** Fichas acreditadas. */
  cargasNetas: number;
  /** Lo que se les transfirió a los jugadores por retiros. */
  premios: number;
  /** Fichas que salieron por retiros (lo pedido, antes de la comisión de retiro). */
  retirosFichas: number;
  /** Impuesto de la plataforma sobre las cargas. */
  impuesto: number;
  /** ingresos − premios. */
  resultado: number;
}

/** Suma los pedidos cerrados (acreditados o pagados) que cumplen el filtro. */
export async function balance(tx: Pick<Tx, 'pedido'>, donde: Prisma.PedidoWhereInput): Promise<Balance> {
  const grupos = await tx.pedido.groupBy({
    by: ['tipo'],
    where: { ...donde, estado: { in: ['acreditado', 'pagado'] } },
    _count: { _all: true },
    _sum: { monto: true, montoPagado: true, ganancia: true, impuesto: true },
  });
  const carga = grupos.find((g) => g.tipo === 'carga');
  const retiro = grupos.find((g) => g.tipo === 'retiro');
  const ingresos = carga?._sum.montoPagado ?? 0;
  const premios = retiro?._sum.monto ?? 0;
  return {
    cantidadCargas: carga?._count._all ?? 0,
    cantidadRetiros: retiro?._count._all ?? 0,
    ingresos,
    comision: (carga?._sum.ganancia ?? 0) + (retiro?._sum.ganancia ?? 0),
    cargasNetas: carga?._sum.monto ?? 0,
    premios,
    // En un retiro, lo pedido = lo transferido + la comisión de retiro.
    retirosFichas: premios + (retiro?._sum.ganancia ?? 0),
    impuesto: carga?._sum.impuesto ?? 0,
    resultado: ingresos - premios,
  };
}

export async function saldoCaja(tx: Pick<Tx, 'movimientoCaja'>): Promise<number> {
  const { _sum } = await tx.movimientoCaja.aggregate({ _sum: { monto: true } });
  return _sum.monto ?? 0;
}

/** Lunes de esta semana, 00:00 en Argentina. */
export function inicioDeSemana(ahora = new Date()): Date {
  const hoy = inicioDeFecha(fechaArgentina(ahora));
  const diaSemana = new Date(hoy.getTime() + 3 * 3600_000).getUTCDay(); // 0 = domingo
  return new Date(hoy.getTime() - ((diaSemana + 6) % 7) * 24 * 3600_000);
}
