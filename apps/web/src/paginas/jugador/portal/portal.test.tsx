import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CuentaPropia, PedidoJugador, ParametrosPortal } from '../../../api/portal';
import { ProveedorPortalEnVivo } from '../../../sesion/portalEnVivo';
import { ProveedorSesionJugador } from '../../../sesion/sesion';
import { apiFalsa, respuesta } from '../../../test/apiFalsa';
import { Cargar } from './Cargar';
import { Cuentas } from './Cuentas';
import { Inicio } from './Inicio';
import { Retirar } from './Retirar';

class FuenteFalsa {
  static ultima: FuenteFalsa | null = null;
  oyentes: Record<string, (() => void)[]> = {};
  constructor(public url: string) {
    FuenteFalsa.ultima = this;
  }
  addEventListener(tipo: string, fn: () => void) {
    (this.oyentes[tipo] ??= []).push(fn);
  }
  close() {}
  emitir(tipo: string) {
    for (const fn of this.oyentes[tipo] ?? []) fn();
  }
}

const jugador = { id: 'j1', nombreUsuario: 'ana', telefono: '5491144441234', usuarioPlataforma: 'ana99', debeCambiarContrasena: false };
const parametros: ParametrosPortal = {
  comision: { modo: 'recargo', porcentajePb: 500 },
  montos: { cargaMinima: 100_000, cargaMaxima: 50_000_000, retiroMinimo: 200_000, retiroConAprobacionDesde: 10_000_000 },
  cuentasPendientesMaximas: 3,
  datosPago: { alias: 'carga24.pagos', titular: 'Carga24 SRL', banco: 'Galicia' },
  horario: '',
  whatsapp: '',
  plataforma: { id: 'pl', nombre: 'Plataforma principal' },
};
const cuenta = (extra: Partial<CuentaPropia> = {}): CuentaPropia => ({ id: 'c1', cbuCvu: '0000003100012345678901', alias: 'ana.mp', banco: null, titular: null, estado: 'pendiente', creadoEn: '2026-11-20T00:00:00Z', ...extra });
const pedido = (extra: Partial<PedidoJugador> = {}): PedidoJugador => ({
  id: 7, tipo: 'carga', estado: 'en_proceso', canal: 'web', monto: 1_000_000, montoPagado: 1_050_000, comision: 50_000, comisionPb: 500, modoComision: 'recargo',
  motivoRechazo: null, cuenta: null, plataforma: { id: 'pl', nombre: 'Plataforma principal' }, comprobantes: [], promo: null, creadoEn: '2026-11-20T15:00:00Z', actualizadoEn: '2026-11-20T15:00:00Z', ...extra,
});

function montar(ruta: string, elemento: React.ReactNode) {
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorSesionJugador>
        <ProveedorPortalEnVivo>
          <Routes>
            <Route path={ruta} element={elemento} />
            <Route path="/pedidos/:id" element={<p>Detalle del pedido</p>} />
            <Route path="*" element={<p>Otra página</p>} />
          </Routes>
        </ProveedorPortalEnVivo>
      </ProveedorSesionJugador>
    </MemoryRouter>,
  );
}

const base = { 'GET /yo': respuesta(200, jugador), 'GET /yo/notificaciones': respuesta(200, { noLeidas: 2, avisos: [] }) };

beforeEach(() => vi.stubGlobal('EventSource', FuenteFalsa));
afterEach(() => vi.unstubAllGlobals());

describe('Cargar saldo', () => {
  it('muestra cuánto transfiere y cuánto recibe, y envía el pedido con el comprobante', async () => {
    const api = apiFalsa({
      ...base,
      'GET /yo/parametros': respuesta(200, parametros),
      'GET /yo/cuentas': respuesta(200, [cuenta()]),
      'POST /yo/pedidos': respuesta(201, { ...pedido({ id: 12, estado: 'pendiente' }), historial: [] }),
    });
    montar('/cargar', <Cargar />);
    await userEvent.type(await screen.findByLabelText('¿Cuánto querés cargar?'), '10.000');
    expect(screen.getByText('Transferís').nextSibling).toHaveTextContent('10.500');
    expect(screen.getByText('Recibís en tu usuario').nextSibling).toHaveTextContent('10.000');
    expect(screen.getByText('carga24.pagos')).toBeInTheDocument();
    expect(screen.getByLabelText('¿Desde qué cuenta transferís?')).toHaveValue('c1'); // única cuenta: elegida sola
    const enviar = screen.getByRole('button', { name: 'Enviar pedido' });
    expect(enviar).toBeDisabled(); // falta el comprobante
    await userEvent.upload(screen.getByLabelText(/Comprobante de la transferencia/), new File(['x'], 'pago.png', { type: 'image/png' }));
    await userEvent.click(enviar);
    expect(await screen.findByText('Detalle del pedido')).toBeInTheDocument();
    expect(api.enviado('POST /yo/pedidos')).toEqual([{ tipo: 'carga', monto: '1000000', cuentaId: 'c1', archivo: 'archivo:pago.png' }]);
  });

  it('valida el código de promo y lo manda con el pedido', async () => {
    const api = apiFalsa({
      ...base,
      'GET /yo/parametros': respuesta(200, parametros),
      'GET /yo/cuentas': respuesta(200, [cuenta()]),
      'GET /promociones/validar/NOVALE': respuesta(400, { mensaje: 'Ese código de promo no existe o ya no está vigente' }),
      'GET /promociones/validar/FINDE10': respuesta(200, { id: 'p', titulo: 'Finde 10% extra', condiciones: 'De viernes a domingo', codigo: 'FINDE10', hasta: '2026-11-22T02:59:59Z' }),
      'POST /yo/pedidos': respuesta(201, { ...pedido({ id: 14 }), historial: [] }),
    });
    montar('/cargar', <Cargar />);
    const campo = await screen.findByLabelText('¿Tenés un código de promo?');
    await userEvent.type(campo, 'novale');
    expect(campo).toHaveValue('NOVALE');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(await screen.findByText(/no existe o ya no está vigente/)).toBeInTheDocument();
    await userEvent.clear(campo);
    await userEvent.type(campo, 'FINDE10');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(await screen.findByText('Finde 10% extra')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('¿Cuánto querés cargar?'), '10.000');
    await userEvent.upload(screen.getByLabelText(/Comprobante de la transferencia/), new File(['x'], 'pago.png', { type: 'image/png' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }));
    await screen.findByText('Detalle del pedido');
    expect(api.enviado('POST /yo/pedidos')[0]).toMatchObject({ codigoPromo: 'FINDE10' });
  });

  it('sin cuentas, pide cargar una primero', async () => {
    apiFalsa({ ...base, 'GET /yo/parametros': respuesta(200, parametros), 'GET /yo/cuentas': respuesta(200, []) });
    montar('/cargar', <Cargar />);
    expect(await screen.findByRole('link', { name: 'Agregar cuenta' })).toHaveAttribute('href', '/cuentas');
  });

  it('avisa si el monto está fuera del rango', async () => {
    apiFalsa({ ...base, 'GET /yo/parametros': respuesta(200, parametros), 'GET /yo/cuentas': respuesta(200, [cuenta()]) });
    montar('/cargar', <Cargar />);
    await userEvent.type(await screen.findByLabelText('¿Cuánto querés cargar?'), '500');
    expect(screen.getByText('El monto está fuera del rango permitido')).toBeInTheDocument();
  });
});

describe('Retirar', () => {
  it('solo ofrece cuentas verificadas y avisa si necesita aprobación', async () => {
    const api = apiFalsa({
      ...base,
      'GET /yo/parametros': respuesta(200, parametros),
      'GET /yo/cuentas': respuesta(200, [cuenta(), cuenta({ id: 'c2', alias: 'ana.banco', estado: 'verificada' })]),
      'POST /yo/pedidos': respuesta(201, { ...pedido({ id: 13, tipo: 'retiro' }), historial: [] }),
    });
    montar('/retirar', <Retirar />);
    const selector = await screen.findByLabelText('¿A qué cuenta?');
    expect(selector).toHaveValue('c2');
    expect(screen.queryByRole('option', { name: 'ana.mp' })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('¿Cuánto querés retirar?'), '150.000');
    expect(screen.getByText(/un supervisor tiene que aprobarlo/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Pedir retiro' }));
    expect(await screen.findByText('Detalle del pedido')).toBeInTheDocument();
    expect(api.enviado('POST /yo/pedidos')).toEqual([{ tipo: 'retiro', monto: '15000000', cuentaId: 'c2' }]);
  });
});

describe('Inicio', () => {
  it('muestra el pedido en curso con su avance y se actualiza en vivo', async () => {
    let estado: PedidoJugador['estado'] = 'en_proceso';
    apiFalsa({
      ...base,
      'GET /yo/pedidos?pagina=1': () => respuesta(200, { total: 1, pagina: 1, porPagina: 20, pedidos: [pedido({ estado })] }),
      'GET /yo/novedades': respuesta(200, [{ id: 'n1', titulo: 'Promo de bienvenida', texto: '10% extra', fijada: true, publicadaEn: '2026-11-20T00:00:00Z' }]),
    });
    montar('/inicio', <Inicio />);
    expect(await screen.findByText('Carga #7 en curso')).toBeInTheDocument();
    expect(screen.getByText('Estamos buscando tu transferencia en el banco.')).toBeInTheDocument();
    expect(screen.getByText('Promo de bienvenida')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Avisos, 2 sin leer' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Cargar/ })).not.toBeInTheDocument();

    estado = 'acreditado';
    act(() => FuenteFalsa.ultima!.emitir('pedido.actualizado'));
    expect(await screen.findByRole('link', { name: /Cargar/ })).toBeInTheDocument();
  });
});

describe('Cuentas', () => {
  it('agrega una cuenta y muestra los errores por campo', async () => {
    let cuentas: CuentaPropia[] = [];
    const api = apiFalsa({
      ...base,
      'GET /yo/cuentas': () => respuesta(200, cuentas),
      'POST /yo/cuentas': (cuerpo) => {
        if ((cuerpo as { cbuCvu: string }).cbuCvu.length < 22) return respuesta(400, { mensaje: 'El CBU o CVU tiene 22 números', errores: [{ campo: 'cbuCvu', mensaje: 'El CBU o CVU tiene 22 números' }] });
        cuentas = [cuenta()];
        return respuesta(201, cuentas[0]);
      },
    });
    montar('/cuentas', <Cuentas />);
    expect(await screen.findByText('Todavía no cargaste ninguna cuenta.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Agregar cuenta' }));
    await userEvent.type(screen.getByLabelText('CBU o CVU'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('El CBU o CVU tiene 22 números')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('CBU o CVU'));
    await userEvent.type(screen.getByLabelText('CBU o CVU'), '0000003100012345678901');
    await userEvent.type(screen.getByLabelText('Alias (opcional)'), 'ana.mp');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Se verifica con tu primer pago')).toBeInTheDocument();
    expect(api.enviado('POST /yo/cuentas').at(-1)).toEqual({ cbuCvu: '0000003100012345678901', alias: 'ana.mp' });
  });
});
