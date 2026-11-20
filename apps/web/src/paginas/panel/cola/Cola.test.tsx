import { PERFILES_INICIALES, TODOS_LOS_PERMISOS } from '@carga24/shared';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pedido } from '../../../api/pedidos';
import { ProveedorSesionStaff } from '../../../sesion/sesion';
import { apiFalsa, respuesta } from '../../../test/apiFalsa';
import { Cola } from './Cola';
import { leerPesos } from '../../../comun/formato';

/** EventSource falso: guarda la instancia para poder "mandar" avisos desde el test. */
class FuenteFalsa {
  static ultima: FuenteFalsa | null = null;
  oyentes: Record<string, ((e: MessageEvent<string>) => void)[]> = {};
  constructor(public url: string) {
    FuenteFalsa.ultima = this;
  }
  addEventListener(tipo: string, fn: (e: MessageEvent<string>) => void) {
    (this.oyentes[tipo] ??= []).push(fn);
  }
  close() {}
  emitir(tipo: string, datos: unknown) {
    for (const fn of this.oyentes[tipo] ?? []) fn({ data: JSON.stringify(datos) } as MessageEvent<string>);
  }
}

const laura = { id: 'laura', nombreUsuario: 'laura', nombreVisible: 'Laura', perfil: { id: 'p', nombre: 'Operador' }, permisos: PERFILES_INICIALES.Operador };
const ahora = new Date().toISOString();
const base: Pedido = {
  id: 1, tipo: 'carga', estado: 'pendiente', canal: 'manual', medioPago: 'otra_cuenta', monto: 1_000_000, montoPagado: 1_050_000, ganancia: 50_000,
  comisionPb: 500, modoComision: 'recargo', referenciaMovimiento: null, motivoRechazo: null, telefono: '5491144441234',
  jugador: { id: 'j1', nombreUsuario: 'ana', telefono: '5491144441234', usuarioPlataforma: 'ana99' }, plataforma: { id: 'pl', nombre: 'Plataforma principal' },
  cuenta: null, tomadoPor: null, tomadoEn: null, verificadoPor: null, ejecutadoPor: null, comprobantes: [], requiereAprobacion: false, creadoEn: ahora, actualizadoEn: ahora,
};

function montar() {
  render(
    <MemoryRouter initialEntries={['/panel/cola']}>
      <ProveedorSesionStaff>
        <Routes>
          <Route path="/panel/cola" element={<Cola />} />
        </Routes>
      </ProveedorSesionStaff>
    </MemoryRouter>,
  );
}

const columna = (nombre: RegExp) => screen.getByRole('region', { name: nombre });

beforeEach(() => {
  vi.stubGlobal('EventSource', FuenteFalsa);
});
afterEach(() => vi.unstubAllGlobals());

describe('Cola de pedidos', () => {
  it('reparte los pedidos en sus columnas y muestra las acciones de cada uno', async () => {
    apiFalsa({
      'GET /auth/staff/yo': respuesta(200, laura),
      'GET /pedidos/cola': respuesta(200, [
        base,
        { ...base, id: 2, estado: 'en_proceso', tomadoPor: { id: 'laura', nombre: 'Laura' } },
        { ...base, id: 3, estado: 'en_proceso', tomadoPor: { id: 'pablo', nombre: 'Pablo' } },
        { ...base, id: 4, tipo: 'retiro', estado: 'verificado', montoPagado: null },
        { ...base, id: 5, estado: 'rechazado', motivoRechazo: 'El pago no llegó' },
      ]),
    });
    montar();

    const pendientes = await screen.findByRole('region', { name: /Pendientes/ });
    expect(within(pendientes).getByRole('button', { name: 'Tomar' })).toBeInTheDocument();

    const enProceso = columna(/En proceso/);
    const mio = within(enProceso).getByRole('article', { name: 'Carga #2' });
    expect(within(mio).getByRole('button', { name: 'Verificar pago' })).toBeInTheDocument();
    expect(within(mio).getByRole('button', { name: 'No llegó' })).toBeInTheDocument();
    expect(within(mio).getByText('Vos')).toBeInTheDocument();
    const ajeno = within(enProceso).getByRole('article', { name: 'Carga #3' });
    expect(within(ajeno).getByText('Pablo')).toBeInTheDocument();
    expect(within(ajeno).queryByRole('button', { name: 'Verificar pago' })).not.toBeInTheDocument();

    // El perfil Operador no paga retiros: la columna "Por acreditar / pagar" no le ofrece el botón.
    expect(within(columna(/Por acreditar/)).queryByRole('button', { name: 'Marcar pagado' })).not.toBeInTheDocument();
    expect(within(columna(/Cerrados hoy/)).getByText('El pago no llegó')).toBeInTheDocument();
    expect(document.title).toBe('(1) Cola · Carga24');
  });

  it('tomar pasa por un modal de confirmación', async () => {
    const api = apiFalsa({
      'GET /auth/staff/yo': respuesta(200, laura),
      'GET /pedidos/cola': respuesta(200, [base]),
      'POST /pedidos/1/tomar': respuesta(200, { ...base, estado: 'en_proceso', eventos: [] }),
    });
    montar();
    await userEvent.click(await screen.findByRole('button', { name: 'Tomar' }));
    const modal = screen.getByRole('dialog', { name: '¿Tomás el pedido #1?' });
    expect(within(modal).getByText('ana99', { exact: false })).toBeInTheDocument();
    expect(api.enviado('POST /pedidos/1/tomar')).toHaveLength(0);
    await userEvent.click(within(modal).getByRole('button', { name: 'Tomar pedido' }));
    expect(api.enviado('POST /pedidos/1/tomar')).toHaveLength(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('verificar un pago exige el número de operación y muestra el error de la API', async () => {
    const api = apiFalsa({
      'GET /auth/staff/yo': respuesta(200, laura),
      'GET /pedidos/cola': respuesta(200, [{ ...base, estado: 'en_proceso', tomadoPor: { id: 'laura', nombre: 'Laura' } }]),
      'POST /pedidos/1/verificar': respuesta(409, { mensaje: 'Ese número de operación ya se usó en el pedido #7' }),
    });
    montar();
    await userEvent.click(await screen.findByRole('button', { name: 'Verificar pago' }));
    const modal = screen.getByRole('dialog', { name: '¿Encontraste el pago en el banco?' });
    const confirmar = within(modal).getByRole('button', { name: 'Sí, verificar pago' });
    expect(confirmar).toBeDisabled();
    await userEvent.type(within(modal).getByLabelText('Número de operación del banco'), 'OP-1');
    await userEvent.click(confirmar);
    expect(await within(modal).findByRole('alert')).toHaveTextContent('ya se usó en el pedido #7');
    expect(api.enviado('POST /pedidos/1/verificar')).toEqual([{ referenciaMovimiento: 'OP-1' }]);
  });

  it('"No llegó" rechaza con el motivo ya elegido', async () => {
    const api = apiFalsa({
      'GET /auth/staff/yo': respuesta(200, laura),
      'GET /pedidos/cola': respuesta(200, [{ ...base, estado: 'en_proceso', tomadoPor: { id: 'laura', nombre: 'Laura' } }]),
      'POST /pedidos/1/rechazar': respuesta(200, { ...base, estado: 'rechazado', eventos: [] }),
    });
    montar();
    await userEvent.click(await screen.findByRole('button', { name: 'No llegó' }));
    const modal = screen.getByRole('dialog');
    expect(within(modal).getByLabelText('Motivo')).toHaveValue('no_llego');
    await userEvent.click(within(modal).getByRole('button', { name: 'Rechazar' }));
    expect(api.enviado('POST /pedidos/1/rechazar')).toEqual([{ motivo: 'no_llego' }]);
  });

  it('se actualiza sola cuando entra un pedido y lo resalta', async () => {
    let cola = [base];
    const api = apiFalsa({
      'GET /auth/staff/yo': respuesta(200, { ...laura, permisos: TODOS_LOS_PERMISOS }),
      'GET /pedidos/cola': () => respuesta(200, cola),
    });
    montar();
    await screen.findByRole('article', { name: 'Carga #1' });
    cola = [base, { ...base, id: 9, jugador: null, telefono: '5491199990000' }];
    act(() => FuenteFalsa.ultima!.emitir('pedido.creado', { tipo: 'pedido.creado', pedidoId: 9, estado: 'pendiente', actorId: 'otro' }));
    expect(await screen.findByRole('article', { name: 'Carga #9' }, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByText('+54 9 11 9999-0000')).toBeInTheDocument();
    expect(api.llamadas.filter((l) => l.clave === 'GET /pedidos/cola')).toHaveLength(2);
    expect(FuenteFalsa.ultima!.url).toBe('/api/v1/pedidos/eventos');
  });
});

describe('leerPesos', () => {
  it('entiende montos escritos como en Argentina', () => {
    expect(leerPesos('10.000')).toBe(1_000_000);
    expect(leerPesos('$ 10.500,50')).toBe(1_050_050);
    expect(leerPesos('2500')).toBe(250_000);
    expect(leerPesos('abc')).toBeNull();
    expect(leerPesos('1,234')).toBeNull();
  });
});
