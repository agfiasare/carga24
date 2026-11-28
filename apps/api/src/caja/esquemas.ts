import { z } from 'zod';

/** Lo que se valida en cada pedido a la API de caja. */
export const esquemaCierre = z.object({
  saldoInformado: z.number().int('El saldo va en centavos enteros').min(-100_000_000_000).max(100_000_000_000).optional(),
  nota: z.string().trim().max(500, 'La nota es muy larga').optional(),
});
export const esquemaLiquidacion = z.object({
  monto: z.number({ error: 'Escribí el monto' }).int('El monto va en centavos enteros').positive('El monto tiene que ser mayor a cero').max(100_000_000_000),
  nota: z.string().trim().max(300, 'La nota es muy larga').optional(),
});
export const esquemaAjuste = z.object({
  monto: z.number({ error: 'Escribí el monto' }).int('El monto va en centavos enteros').min(-100_000_000_000).max(100_000_000_000).refine((m) => m !== 0, 'El ajuste no puede ser cero'),
  nota: z.string({ error: 'Explicá el motivo del ajuste' }).trim().min(3, 'Explicá el motivo del ajuste').max(300, 'La nota es muy larga'),
});
export const esquemaRendicion = z.object({
  monto: z.number({ error: 'Escribí el monto' }).int('El monto va en centavos enteros').min(-100_000_000_000).max(100_000_000_000),
  nota: z.string().trim().max(300, 'La nota es muy larga').optional(),
});

export type DatosCierre = z.infer<typeof esquemaCierre>;
export type DatosLiquidacion = z.infer<typeof esquemaLiquidacion>;
export type DatosAjuste = z.infer<typeof esquemaAjuste>;
export type DatosRendicion = z.infer<typeof esquemaRendicion>;
