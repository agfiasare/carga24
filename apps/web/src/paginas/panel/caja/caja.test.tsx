import { TODOS_LOS_PERMISOS } from '@carga24/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EstadoCaja, EstadoRendiciones, ResumenTurno } from '../../../api/caja';
import { ProveedorSesionStaff } from '../../../sesion/sesion';
import { apiFalsa, respuesta } from '../../../test/apiFalsa';
import { Caja } from './Caja';
import { CerrarTurno } from './CerrarTurno';
import { ComprobanteTurno } from './ComprobanteTurno';
import { Rendiciones } from './Rendiciones';

const yo = (permisos: readonly string[] = TODOS_LOS_PERMISOS, id = 'laura') => ({ id, nombreUsuario: id, nombreVisible: 'Laura', perfil: { id: 'p', nombre: 'Admin' }, permisos });
const ahora = new Date().toISOString();

function montar(ruta: string, patron: string, elemento: React.ReactNode) {
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorSesionStaff>
        <Routes>
          <Route path={patron} element={elemento} />
        </Routes>
      </ProveedorSesionStaff>
    </MemoryRouter>,
  );
}

afterEach(() => vi.unstubAllGlobals());

const turno: ResumenTurno = {
  id: 't1',
  usuario: { id: 'laura', nombre: 'Laura' },
  abiertoEn: ahora,
  cerradoEn: null,
  cerradoPor: null,
  cajaAlAbrir: -40_000_000,
  cajaAlCerrar: 95_000_000,
  saldoInformado: null,
  nota: null,
  cantidadCargas: 38,
  cantidadRetiros: 12,
  ingresos: 345_000_000,
  comision: 10_350_000,
  cargasNetas: 334_650_000,
  premios: 210_000_000,
  retirosFichas: 210_000_000,
  impuesto: 0,
  resultado: 135_000_000,
  cajaAntes: -40_000_000,
  tomados: [{ id: 1291, tipo: 'carga', monto: 2_500_000 }],
  pedidosAbiertos: 2,
};

describe('Cerrar turno', () => {
  it('muestra el balance, avisa lo tomado y cierra con el control y la nota', async () => {
    const api = apiFalsa({
      'GET /auth/staff/yo': respuesta(200, yo(['pedidos.ver'])),
      'GET /turnos/t1': respuesta(200, turno),
      'POST /turnos/t1/cierre': respuesta(200, { ...turno, cerradoEn: ahora, cerradoPor: { id: 'laura', nombre: 'Laura' }, saldoInformado: 94_000_000, nota: 'Faltan 10.000', tomados: [] }),
    });
    montar('/panel/turnos/t1', '/panel/turnos/:id', <CerrarTurno />);

    const balance = await screen.findByRole('region', { name: 'Balance del turno' });
    expect(within(balance).getByText('Ingresos (38 cargas)').nextSibling).toHaveTextContent('$ 3.450.000');
    expect(within(balance).getByText('Resultado del turno').nextSibling).toHaveTextContent('+$ 1.350.000');
    expect(within(balance).getByText('Caja sin liquidar al cerrar').nextSibling).toHaveTextContent('$ 950.000');
    expect(screen.getByText('Queda 1 pedido tomado')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Lo que hay realmente/), '940.000');
    expect(screen.getByText(/Faltan \$ 10.000/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nota para el turno siguiente'), 'Faltan 10.000');
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar turno' }));
    const modal = screen.getByRole('dialog', { name: '¿Cerrar el turno?' });
    expect(within(modal).getByText(/Se libera el pedido tomado/)).toBeInTheDocument();
    await userEvent.click(within(modal).getByRole('button', { name: 'Cerrar turno' }));

    expect(await screen.findByText(/Turno cerrado\./)).toBeInTheDocument();
    expect(api.enviado('POST /turnos/t1/cierre')).toEqual([{ saldoInformado: 94_000_000, nota: 'Faltan 10.000' }]);
    expect(screen.queryByLabelText(/Lo que hay realmente/)).not.toBeInTheDocument();
  });

  it('un turno ajeno sin permiso se ve pero no se cierra', async () => {
    apiFalsa({
      'GET /auth/staff/yo': respuesta(200, yo(['caja.ver'], 'otra')),
      'GET /turnos/t1': respuesta(200, turno),
    });
    montar('/panel/turnos/t1', '/panel/turnos/:id', <CerrarTurno />);
    expect(await screen.findByText(/Este turno sigue abierto/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar turno' })).not.toBeInTheDocument();
  });
});

const estadoCaja: EstadoCaja = {
  saldo: 95_000_000,
  ultimaLiquidacion: null,
  gananciaSemana: 81_240_000,
  turnosAbiertos: [],
  turnosSinLiquidar: [{ ...turno, cerradoEn: ahora }],
  movimientos: [{ id: 'm1', tipo: 'cierre_turno', monto: 135_000_000, saldoPosterior: 95_000_000, nota: null, creadoEn: ahora, creadoPor: 'Laura', pedidoId: null, turno: { id: 't1', usuario: 'Laura', abiertoEn: ahora, cerradoEn: ahora } }],
};

describe('Caja', () => {
  it('muestra el saldo, los turnos y los movimientos; liquida con el saldo propuesto', async () => {
    const api = apiFalsa({
      'GET /auth/staff/yo': respuesta(200, yo()),
      'GET /caja': respuesta(200, estadoCaja),
      'POST /caja/liquidaciones': respuesta(201, { ...estadoCaja, saldo: 0, turnosSinLiquidar: [] }),
    });
    montar('/panel/caja', '/panel/caja', <Caja />);
    expect(await screen.findByText('Caja sin liquidar')).toBeInTheDocument();
    const sinLiquidar = screen.getByRole('region', { name: 'Turnos sin liquidar' });
    expect(within(sinLiquidar).getAllByText('+$ 1.350.000')).toHaveLength(2);
    expect(within(screen.getByRole('region', { name: 'Movimientos de la caja' })).getByText('Cierre de turno')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Registrar liquidación' }));
    const modal = screen.getByRole('dialog', { name: 'Registrar liquidación' });
    const monto = within(modal).getByLabelText('Monto que se liquida');
    expect(monto).toHaveValue('950.000');
    await userEvent.clear(monto);
    await userEvent.type(monto, '1.000.000');
    expect(within(modal).getByText('No puede ser más que el saldo de la caja')).toBeInTheDocument();
    await userEvent.clear(monto);
    await userEvent.type(monto, '950.000');
    await userEvent.type(within(modal).getByLabelText('Nota (opcional)'), 'A caja de ahorro');
    await userEvent.click(within(modal).getByRole('button', { name: 'Registrar liquidación' }));
    expect(api.enviado('POST /caja/liquidaciones')).toEqual([{ monto: 95_000_000, nota: 'A caja de ahorro' }]);
    expect(await screen.findByText('No hay turnos cerrados sin liquidar.')).toBeInTheDocument();
  });

  it('el ajuste pide motivo y manda el monto con signo', async () => {
    const api = apiFalsa({
      'GET /auth/staff/yo': respuesta(200, yo()),
      'GET /caja': respuesta(200, estadoCaja),
      'POST /caja/ajustes': respuesta(201, { ...estadoCaja, saldo: 94_500_000 }),
    });
    montar('/panel/caja', '/panel/caja', <Caja />);
    await userEvent.click(await screen.findByRole('button', { name: 'Ajuste manual' }));
    const modal = screen.getByRole('dialog', { name: 'Ajuste manual' });
    await userEvent.type(within(modal).getByLabelText('Monto'), '5.000');
    expect(within(modal).getByRole('button', { name: 'Registrar ajuste' })).toBeDisabled();
    await userEvent.type(within(modal).getByLabelText('Motivo'), 'Pedido #1180 mal cargado');
    await userEvent.click(within(modal).getByRole('button', { name: 'Registrar ajuste' }));
    expect(api.enviado('POST /caja/ajustes')).toEqual([{ monto: -500_000, nota: 'Pedido #1180 mal cargado' }]);
  });

  it('sin caja.liquidar no ofrece liquidar', async () => {
    apiFalsa({
      'GET /auth/staff/yo': respuesta(200, yo(['caja.ver'])),
      'GET /caja': respuesta(200, estadoCaja),
    });
    montar('/panel/caja', '/panel/caja', <Caja />);
    expect(await screen.findByText('Caja sin liquidar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar liquidación' })).not.toBeInTheDocument();
  });
});

describe('Rendiciones', () => {
  const estado: EstadoRendiciones = {
    pendiente: { desde: ahora, hasta: ahora, cargasNetas: 1_842_000_000, premios: 1_193_000_000, comision: 56_970_000, cantidadPedidos: 210, arrastre: 0, correspondia: 649_000_000 },
    historial: [{ id: 'r1', desde: ahora, hasta: ahora, cargasNetas: 0, premios: 0, arrastre: 0, correspondia: 573_000_000, rendido: 570_000_000, nota: null, creadoEn: ahora, creadoPor: 'Admin' }],
  };

  it('propone lo que corresponde y muestra cuánto pasa a la siguiente', async () => {
    const api = apiFalsa({
      'GET /auth/staff/yo': respuesta(200, yo()),
      'GET /rendiciones': respuesta(200, estado),
      'POST /rendiciones': respuesta(201, estado),
    });
    montar('/panel/rendiciones', '/panel/rendiciones', <Rendiciones />);
    const pendiente = await screen.findByRole('region', { name: 'A rendir desde la última rendición' });
    expect(within(pendiente).getByText('A rendir').nextSibling).toHaveTextContent('$ 6.490.000');
    expect(within(screen.getByRole('region', { name: 'Historial' })).getByText('+$ 30.000 a la siguiente')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Monto rendido'), '6.400.000');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar rendición' }));
    const modal = screen.getByRole('dialog', { name: 'Registrar rendición' });
    expect(within(modal).getByText('Pasa a la siguiente').nextSibling).toHaveTextContent('+$ 90.000');
    await userEvent.click(within(modal).getByRole('button', { name: 'Registrar' }));
    expect(api.enviado('POST /rendiciones')).toEqual([{ monto: 640_000_000 }]);
    expect(await screen.findByText('Rendición registrada.')).toBeInTheDocument();
  });
});

describe('Comprobante de turno', () => {
  it('muestra el resumen como ticket y cada movimiento con su detalle', async () => {
    apiFalsa({
      'GET /auth/staff/yo': respuesta(200, yo()),
      'GET /turnos/t1/comprobante': respuesta(200, {
        ...turno,
        cerradoEn: ahora,
        cantidadCargas: 1,
        cantidadRetiros: 1,
        ingresos: 1_000_000,
        cargasNetas: 970_000,
        impuesto: 25_000,
        comision: 44_250,
        premios: 985_000,
        retirosFichas: 1_000_000,
        resultado: 15_000,
        pedidos: [
          { id: 11, tipo: 'carga', canal: 'web', monto: 970_000, montoPagado: 1_000_000, ganancia: 29_250, impuesto: 25_000, ejecutadoEn: ahora, jugador: 'ana' },
          { id: 12, tipo: 'retiro', canal: 'manual', monto: 985_000, montoPagado: 1_000_000, ganancia: 15_000, impuesto: 0, ejecutadoEn: ahora, jugador: 'nuevo' },
        ],
      }),
    });
    montar('/panel/turnos/t1/comprobante', '/panel/turnos/:id/comprobante', <ComprobanteTurno />);
    const ticket = await screen.findByRole('article', { name: 'Comprobante' });
    expect(within(ticket).getByText('1 CARGAS:').nextSibling).toHaveTextContent('$ 10.000');
    expect(within(ticket).getByText('impuesto plataforma').nextSibling).toHaveTextContent('$ 250');
    expect(within(ticket).getByText('comisión de retiro').nextSibling).toHaveTextContent('$ 150');
    expect(within(ticket).getByText('RDO NETO (plataforma):').nextSibling).toHaveTextContent('−$ 300');
    expect(within(ticket).getByText('DETALLE DE MOVIMIENTOS (2)')).toBeInTheDocument();
    expect(within(ticket).getByText(/#12 RETIRO/)).toBeInTheDocument();
    expect(within(ticket).getByText('nuevo · WhatsApp')).toBeInTheDocument();
  });
});

