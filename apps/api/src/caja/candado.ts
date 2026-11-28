import type { Prisma } from '../generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

/** Cierres, liquidaciones, ajustes, rendiciones y la ejecución de pedidos se hacen de a uno. */
const CANDADO_CAJA = 24_240_001;
export async function bloquearCaja(tx: Tx): Promise<void> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(${CANDADO_CAJA})::text AS ok`;
}

/** Turno abierto de una persona (o null). */
export function turnoAbiertoDe(tx: Pick<Tx, 'turno'>, usuarioId: string) {
  return tx.turno.findFirst({ where: { usuarioId, cerradoEn: null } });
}

export const SIN_TURNO = 'Iniciá tu turno para operar pedidos';
