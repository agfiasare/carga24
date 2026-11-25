import { formatearPesos } from '@carga24/shared';
import { textoEstado } from '../../../componentes/atomos/InsigniaEstado/InsigniaEstado';
import type { Pedido } from '../../../api/pedidos';
import { formatearTelefono } from '../../../comun/formato';

/** Minúsculas y sin tildes: "Acreditada" encuentra "acreditada", "José" encuentra "jose". */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Formas en que alguien puede escribir un monto: 1050050 centavos → "10500.50", "10.500,50", "$ 10.500,50"… */
function formasDeMonto(centavos: number | null): string[] {
  if (centavos === null) return [];
  const pesos = Math.floor(centavos / 100);
  const conCentavos = centavos % 100 === 0 ? [] : [`${pesos},${String(centavos % 100).padStart(2, '0')}`];
  return [String(pesos), formatearPesos(centavos), formatearPesos(centavos).replace(/\s/g, ''), ...conCentavos];
}

/** Todo lo buscable de un pedido, en un solo texto normalizado. */
export function textoBuscable(p: Pedido): string {
  const partes = [
    String(p.id),
    `#${p.id}`,
    p.tipo,
    textoEstado(p.estado, p.tipo),
    p.canal === 'manual' ? 'whatsapp manual' : 'web',
    p.jugador?.nombreUsuario,
    p.jugador?.usuarioPlataforma,
    p.telefono,
    p.jugador?.telefono,
    formatearTelefono(p.jugador?.telefono ?? p.telefono),
    // El teléfono sin el 549: lo que escribiría alguien de memoria (11 4444 1234).
    (p.jugador?.telefono ?? p.telefono)?.replace(/^549/, ''),
    ...formasDeMonto(p.monto),
    ...formasDeMonto(p.montoPagado),
    p.cuenta?.alias,
    p.cuenta?.cbuCvu,
    p.cuenta?.banco,
    p.cuenta?.titular,
    p.referenciaMovimiento,
    p.plataforma.nombre,
    p.tomadoPor?.nombre,
    p.verificadoPor?.nombre,
    p.ejecutadoPor?.nombre,
    p.promo?.codigo,
    p.motivoRechazo,
  ];
  return normalizar(partes.filter(Boolean).join(' · '));
}

/**
 * ¿El pedido coincide con lo que se escribió? Cada palabra tiene que aparecer.
 * Los números se comparan también sin puntos ni espacios ("11 4444 1234", "10.000").
 */
export function coincide(p: Pedido, consulta: string): boolean {
  const palabras = normalizar(consulta).replace(/\$/g, ' ').split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return true;
  const texto = textoBuscable(p);
  const soloDigitos = texto.replace(/[^\d]/g, ' ');
  const digitosJuntos = texto.replace(/[\s.\-()]/g, '');
  return palabras.every((palabra) => {
    if (texto.includes(palabra)) return true;
    const digitos = palabra.replace(/[.\-()]/g, '');
    if (/^\d+$/.test(digitos)) return soloDigitos.includes(digitos) || digitosJuntos.includes(digitos);
    return false;
  });
}
