import { describe, expect, it } from 'vitest';
import type { Pedido } from '../../../api/pedidos';
import { coincide } from './busqueda';

const pedido: Pedido = {
  id: 1291, tipo: 'carga', estado: 'en_proceso', canal: 'web', medioPago: 'cuenta_registrada', monto: 1_000_000, montoPagado: 1_050_000,
  ganancia: 50_000, comisionPb: 500, modoComision: 'recargo', referenciaMovimiento: 'OP-778899', motivoRechazo: null, telefono: '5491144441234',
  jugador: { id: 'j', nombreUsuario: 'anaPérez', telefono: '5491144441234', usuarioPlataforma: 'ana99' },
  plataforma: { id: 'p', nombre: 'Casino Uno' },
  cuenta: { id: 'c', cbuCvu: '0000003100012345678901', alias: 'ana.mp', banco: 'Mercado Pago', titular: 'Ana Gómez', estado: 'verificada' },
  tomadoPor: { id: 'l', nombre: 'Laura' }, tomadoEn: null, verificadoPor: null, ejecutadoPor: null, comprobantes: [],
  promo: { codigo: 'FINDE10', titulo: 'Finde', condiciones: 'x' }, requiereAprobacion: false, creadoEn: '', actualizadoEn: '',
};

describe('búsqueda en la cola', () => {
  it.each([
    ['1291'],
    ['#1291'],
    ['anaperez'], // sin tilde y en minúsculas
    ['ANA99'],
    ['11 4444 1234'],
    ['1144441234'],
    ['+54 9 11 4444-1234'],
    ['10000'],
    ['10.000'],
    ['$ 10.000'],
    ['10500'], // lo que transfiere
    ['ana.mp'],
    ['0000003100012345678901'],
    ['345678'], // parte del CBU
    ['mercado pago'],
    ['gomez'],
    ['op-778899'],
    ['laura'],
    ['finde10'],
    ['en proceso'],
    ['casino uno'],
    ['web'],
    ['ana 10.000'], // varias palabras: todas
  ])('encuentra "%s"', (consulta) => {
    expect(coincide(pedido, consulta)).toBe(true);
  });

  it.each([['pedro'], ['20000'], ['ana 20.000'], ['whatsapp'], ['rechazad']])('no encuentra "%s"', (consulta) => {
    expect(coincide(pedido, consulta)).toBe(false);
  });

  it('vacío muestra todo', () => {
    expect(coincide(pedido, '   ')).toBe(true);
  });
});
