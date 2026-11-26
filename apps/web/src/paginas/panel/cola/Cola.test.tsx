import { PERFILES_INICIALES, TODOS_LOS_PERMISOS } from '@carga24/shared';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Turno, TurnoActual } from '../../../api/caja';
import type { Pedido } from '../../../api/pedidos';
import { ProveedorSesionStaff } from '../../../sesion/sesion';
import { apiFalsa, respuesta } from '../../../test/apiFalsa';
import { ProveedorTurno } from '../caja/turno';
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
const turno: Turno = {
  id: 't1',
  usuario: { id: 'laura', nombre: 'Laura' },
  abiertoEn: ahora,
  cerradoEn: null,
  cerradoPor: null,
  cajaAlAbrir: -40_000_000,
  cajaAlCerrar: null,
  saldoInformado: null,
  nota: null,
  cantidadCargas: 38,
  cantidadRetiros: 12,
  ingresos: 345_000_000,
  comision: 10_350_000,
  cargasNetas: 334_650_000,
  premios: 210_000_000,
  resultado: 135_000_000,
};
const conTurno: TurnoActual = { turno, requiereTurno: true, caja: -40_000_000, ultimoCierre: { usuario: 'Martín', cerradoEn: ahora } };
const sinTurno: TurnoActual = { turno: null, requiereTurno: true, caja: -40_000_000, ultimoCierre: { usuario: 'Martín', cerradoEn: ahora } };
const base: Pedido = {
  id: 1, tipo: 'carga', estado: 'pendiente', canal: 'manual', medioPago: 'otra_cuenta', monto: 1_000_000, montoPagado: 1_050_000, ganancia: 50_000,
  comisionPb: 500, modoComision: 'recargo', referenciaMovimiento: null, motivoRechazo: null, telefono: '5491144441234',
  jugador: { id: 'j1', nombreUsuario: 'ana', telefono: '5491144441234', usuarioPlataforma: 'ana99' }, plataforma: { id: 'pl', nombre: 'Plataforma principal' },
  cuenta: null, tomadoPor: null, tomadoEn: null, verificadoPor: null, ejecutadoPor: null, comprobantes: [], promo: null, requiereAprobacion: false, creadoEn: ahora, actualizadoEn: ahora,
};

/** Monta la cola y espera a que cargue el turno (sin turno, los botones están desactivados). */
async function montar() {
  render(
    <MemoryRouter initialEntries={['/panel/cola']}>
      <ProveedorSesionStaff>
        <Routes>
          <Route
            path="/panel/cola"
            element={
              <ProveedorTurno>
                <Cola />
              </ProveedorTurno>
            }
          />
        </Routes>
      </ProveedorSesionStaff>
    </MemoryRouter>,
  );
  await screen.findByText(/^Turno abierto$|^Sin turno|^Operás sin turno/);
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
      'GET /turnos/actual': respuesta(200, conTurno),
      'GET /pedidos/cola': respuesta(200, [
        base,
        { ...base, id: 2, estado: 'en_proceso', tomadoPor: { id: 'laura', nombre: 'Laura' } },
        { ...base, id: 3, estado: 'en_proceso', tomadoPor: { id: 'pablo', nombre: 'Pablo' } },
        { ...base, id: 4, tipo: 'retiro', estado: 'verificado', montoPagado: null },
        { ...base, id: 5, estado: 'rechazado', motivoRechazo: 'El pago no llegó' },
      ]),
    });
    await montar();

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
      'GET /turnos/actual': respuesta(200, conTurno),
      'GET /pedidos/cola': respuesta(200, [base]),
      'POST /pedidos/1/tomar': respuesta(200, { ...base, estado: 'en_proceso', eventos: [] }),
    });
    await montar();
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
      'GET /turnos/actual': respuesta(200, conTurno),
      'GET /pedidos/cola': respuesta(200, [{ ...base, estado: 'en_proceso', tomadoPor: { id: 'laura', nombre: 'Laura' } }]),
      'POST /pedidos/1/verificar': respuesta(409, { mensaje: 'Ese número de operación ya se usó en el pedido #7' }),
    });
    await montar();
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
      'GET /turnos/actual': respuesta(200, conTurno),
      'GET /pedidos/cola': respuesta(200, [{ ...base, estado: 'en_proceso', tomadoPor: { id: 'laura', nombre: 'Laura' } }]),
      'POST /pedidos/1/rechazar': respuesta(200, { ...base, estado: 'rechazado', eventos: [] }),
    });
    await montar();
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
      'GET /turnos/actual': respuesta(200, conTurno),
      'GET /pedidos/cola': () => respuesta(200, cola),
    });
    await montar();
    await screen.findByRole('article', { name: 'Carga #1' });
    cola = [base, { ...base, id: 9, jugador: null, telefono: '5491199990000' }];
    act(() => FuenteFalsa.ultima!.emitir('pedido.creado', { tipo: 'pedido.creado', pedidoId: 9, estado: 'pendiente', actorId: 'otro' }));
    expect(await screen.findByRole('article', { name: 'Carga #9' }, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByText('+54 9 11 9999-0000')).toBeInTheDocument();
    expect(api.llamadas.filter((l) => l.clave === 'GET /pedidos/cola')).toHaveLength(2);
    expect(FuenteFalsa.ultima!.url).toBe('/api/v1/pedidos/eventos');
  });
});

describe('Turno', () => {
  it('sin turno se ve la cola, pero no se opera hasta iniciarlo', async () => {
    let abierto = false;
    const api = apiFalsa({
      'GET /auth/staff/yo': respuesta(200, laura),
      'GET /turnos/actual': () => respuesta(200, abierto ? conTurno : sinTurno),
      'POST /turnos': () => {
        abierto = true;
        return respuesta(201, conTurno);
      },
      'GET /pedidos/cola': respuesta(200, [base]),
    });
    await montar();
    expect(screen.getByText('Sin turno: iniciá uno para operar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tomar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Registrar pedido' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Iniciar turno' }));
    const modal = screen.getByRole('dialog', { name: 'Iniciar turno' });
    expect(within(modal).getByText(/Martín · cerrado el/)).toBeInTheDocument();
    expect(within(modal).getByText('-$ 400.000')).toBeInTheDocument();
    await userEvent.click(within(modal).getByRole('button', { name: 'Iniciar turno' }));

    const cerrar = await screen.findByRole('link', { name: 'Cerrar turno' });
    expect(cerrar).toHaveAttribute('href', '/panel/turnos/t1');
    expect(api.enviado('POST /turnos')).toHaveLength(1);
    const barra = screen.getByRole('region', { name: 'Turno' });
    expect(within(barra).getByText('$ 3.450.000')).toBeInTheDocument();
    expect(within(barra).getByText('+$ 1.350.000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tomar' })).toBeEnabled();
  });
});

describe('Turno opcional', () => {
  it('quien tiene turnos.opcional opera sin turno y puede abrir uno igual', async () => {
    apiFalsa({
      'GET /auth/staff/yo': respuesta(200, { ...laura, permisos: TODOS_LOS_PERMISOS }),
      'GET /turnos/actual': respuesta(200, { ...sinTurno, requiereTurno: false }),
      'GET /pedidos/cola': respuesta(200, [base]),
    });
    await montar();
    expect(screen.getByText(/Operás sin turno/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tomar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Registrar pedido' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Iniciar turno' })).toBeInTheDocument();
  });
});

describe('Búsqueda en la cola', () => {
  it('filtra en todas las columnas y "/" lleva al buscador', async () => {
    apiFalsa({
      'GET /auth/staff/yo': respuesta(200, laura),
      'GET /turnos/actual': respuesta(200, conTurno),
      'GET /pedidos/cola': respuesta(200, [
        base,
        { ...base, id: 2, monto: 2_500_000, montoPagado: 2_625_000, jugador: { id: 'j2', nombreUsuario: 'juanp', telefono: '5491155550001', usuarioPlataforma: 'juan' }, telefono: '5491155550001' },
        { ...base, id: 3, estado: 'rechazado', motivoRechazo: 'El pago no llegó' },
      ]),
    });
    await montar();
    await screen.findByRole('article', { name: 'Carga #2' });
    await userEvent.keyboard('/');
    const buscador = screen.getByLabelText('Buscar en la cola');
    expect(buscador).toHaveFocus();
    await userEvent.type(buscador, '25.000');
    expect(screen.getByRole('article', { name: 'Carga #2' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Carga #1' })).not.toBeInTheDocument();
    expect(screen.getByText('1 pedido coincide con “25.000”.')).toBeInTheDocument();
    await userEvent.clear(buscador);
    await userEvent.type(buscador, '11 4444');
    expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-labelledby'))).toEqual(['pedido-1', 'pedido-3']);
    await userEvent.keyboard('{Escape}');
    expect(buscador).toHaveValue('');
    expect(screen.getAllByRole('article')).toHaveLength(3);
    await userEvent.type(buscador, 'nadie');
    expect(screen.getByText(/Nada coincide con “nadie”/)).toBeInTheDocument();
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
