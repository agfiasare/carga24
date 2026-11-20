/**
 * Ciclo de vida de un pedido (carga o retiro).
 *
 * Pendiente → En proceso → (Espera aprobación) → Verificado → Acreditado | Pagado
 * Cualquier estado no final puede pasar a Rechazado.
 * Cada transición pide su propio permiso (ver permisos.ts).
 */

export const TIPOS_PEDIDO = ['carga', 'retiro'] as const;
export type TipoPedido = (typeof TIPOS_PEDIDO)[number];

export const ESTADOS_PEDIDO = [
  'pendiente',
  'en_proceso',
  'espera_aprobacion',
  'verificado',
  'acreditado',
  'pagado',
  'rechazado',
] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

/** Canal por el que entró el pedido. "manual" = lo registró el staff (por ejemplo, desde WhatsApp). */
export const CANALES = ['web', 'manual'] as const;
export type Canal = (typeof CANALES)[number];

export const MEDIOS_PAGO = ['cuenta_registrada', 'otra_cuenta', 'efectivo'] as const;
export type MedioPago = (typeof MEDIOS_PAGO)[number];

export const ESTADOS_FINALES: readonly EstadoPedido[] = ['acreditado', 'pagado', 'rechazado'];

export function esFinal(estado: EstadoPedido): boolean {
  return ESTADOS_FINALES.includes(estado);
}

/** Acción del staff que mueve un pedido de estado. */
export type AccionPedido = 'tomar' | 'liberar' | 'enviar_a_aprobacion' | 'aprobar' | 'verificar' | 'acreditar' | 'pagar' | 'rechazar';

interface Transicion {
  de: readonly EstadoPedido[];
  a: EstadoPedido;
  /** Si se indica, la acción solo vale para ese tipo de pedido. */
  tipo?: TipoPedido;
}

export const TRANSICIONES: Record<AccionPedido, Transicion> = {
  tomar: { de: ['pendiente'], a: 'en_proceso' },
  liberar: { de: ['en_proceso'], a: 'pendiente' },
  enviar_a_aprobacion: { de: ['en_proceso'], a: 'espera_aprobacion', tipo: 'retiro' },
  aprobar: { de: ['espera_aprobacion'], a: 'verificado', tipo: 'retiro' },
  verificar: { de: ['en_proceso'], a: 'verificado' },
  acreditar: { de: ['verificado'], a: 'acreditado', tipo: 'carga' },
  pagar: { de: ['verificado'], a: 'pagado', tipo: 'retiro' },
  rechazar: { de: ['pendiente', 'en_proceso', 'espera_aprobacion', 'verificado'], a: 'rechazado' },
};

/**
 * Devuelve el estado resultante de aplicar una acción, o null si la acción
 * no es válida para ese pedido. El backend rechaza cualquier otro paso.
 */
export function siguienteEstado(tipo: TipoPedido, estado: EstadoPedido, accion: AccionPedido): EstadoPedido | null {
  const t = TRANSICIONES[accion];
  if (t.tipo && t.tipo !== tipo) return null;
  if (!t.de.includes(estado)) return null;
  return t.a;
}

/** Motivos de rechazo: el jugador ve el texto del motivo (y el detalle, si hay). */
export const MOTIVOS_RECHAZO = {
  no_llego: 'El pago no llegó',
  monto_no_coincide: 'El monto no coincide',
  comprobante_invalido: 'Comprobante inválido',
  datos_cuenta: 'Datos de la cuenta incorrectos',
  otro: 'Otro motivo',
} as const;
export type MotivoRechazo = keyof typeof MOTIVOS_RECHAZO;

/** Columnas de la cola del panel. "Cerrados hoy" agrupa los finales del día. */
export type ColumnaCola = 'pendientes' | 'en_proceso' | 'por_completar' | 'cerrados';

export function columnaDe(estado: EstadoPedido): ColumnaCola {
  if (estado === 'pendiente') return 'pendientes';
  if (estado === 'en_proceso' || estado === 'espera_aprobacion') return 'en_proceso';
  if (estado === 'verificado') return 'por_completar';
  return 'cerrados';
}

/** Comprobantes: fotos o PDF de hasta 10 MB. */
export const COMPROBANTE_TAMANO_MAXIMO = 10 * 1024 * 1024;
export const COMPROBANTE_TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
