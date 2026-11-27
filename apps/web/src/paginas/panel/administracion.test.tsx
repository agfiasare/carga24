import { TODOS_LOS_PERMISOS } from '@carga24/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fechaRelativa, type Configuracion as Config, type Resumen } from '../../api/administracion';
import { ProveedorSesionStaff } from '../../sesion/sesion';
import { apiFalsa, respuesta } from '../../test/apiFalsa';
import { Configuracion } from './Configuracion';
import { Reportes } from './Reportes';

const yo = (permisos: string[] = TODOS_LOS_PERMISOS) => ({ id: 'a', nombreUsuario: 'admin', nombreVisible: 'Admin', perfil: { id: 'p', nombre: 'Admin' }, permisos });
const hoy = fechaRelativa();

function montar(ruta: string, elemento: React.ReactNode) {
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorSesionStaff>
        <Routes>
          <Route path={ruta} element={elemento} />
        </Routes>
      </ProveedorSesionStaff>
    </MemoryRouter>,
  );
}

afterEach(() => vi.unstubAllGlobals());

const resumen: Resumen = {
  desde: hoy,
  hasta: hoy,
  totales: { pedidos: 7, cargas: { cantidad: 3, acreditado: 3_500_000, transferido: 3_675_000 }, retiros: { cantidad: 1, pagado: 800_000 }, ganancia: 175_000, rechazados: 2, enCurso: 1 },
  porCanal: [{ canal: 'manual', cargas: 3_500_000, retiros: 800_000, ganancia: 175_000, pedidos: 4, rechazados: 2 }],
  porOperador: [{ id: 'l', nombre: 'Laura', pedidos: 4, acreditado: 3_500_000, pagado: 800_000, ganancia: 175_000, rechazados: 1 }],
  porJugador: [{ id: 'j1', telefono: null, jugador: 'ana', pedidos: 4, cargado: 3_500_000, retirado: 800_000, rechazados: 2 }],
  porDia: [{ fecha: hoy, pedidos: 4, cargas: 3_500_000, retiros: 800_000, ganancia: 175_000, rechazados: 2 }],
};

describe('Reportes', () => {
  it('muestra los totales y desgloses del período, y exporta con los filtros', async () => {
    const api = apiFalsa({
      'GET /auth/staff/yo': respuesta(200, yo()),
      [`GET /reportes/resumen?desde=${hoy}&hasta=${hoy}`]: respuesta(200, resumen),
      [`GET /reportes/pedidos?desde=${hoy}&hasta=${hoy}&pagina=1`]: respuesta(200, { total: 0, pagina: 1, porPagina: 50, pedidos: [] }),
      [`GET /reportes/pedidos?desde=${hoy}&hasta=${hoy}&estado=acreditado&pagina=1`]: respuesta(200, { total: 0, pagina: 1, porPagina: 50, pedidos: [] }),
      [`GET /reportes/pedidos?desde=${hoy}&hasta=${hoy}&operadorId=l&pagina=1`]: respuesta(200, {
        total: 1,
        pagina: 1,
        porPagina: 50,
        pedidos: [{ id: 31, tipo: 'carga', estado: 'rechazado', canal: 'manual', monto: 500_000, montoPagado: 525_000, ganancia: 0, creadoEn: new Date().toISOString(), jugador: 'ana', operador: 'Laura', referenciaMovimiento: null }],
      }),
    });
    montar('/panel/reportes', <Reportes />);
    expect(await screen.findByText('Ganancia', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Ganancia', { selector: 'span' }).nextSibling).toHaveTextContent('1.750');
    // Los desgloses están plegados; una fila abierta trae sus pedidos.
    await userEvent.click(screen.getByText('Por operador'));
    await userEvent.click(screen.getByRole('button', { name: /Laura/ }));
    expect(await screen.findByText('Carga #31')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Laura/ })).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(screen.getByText('Por canal'));
    expect(screen.getByRole('button', { name: /WhatsApp/ })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'acreditado');
    expect(screen.getByRole('link', { name: /Exportar a Excel/ })).toHaveAttribute('href', `/api/v1/reportes/pedidos.xlsx?desde=${hoy}&hasta=${hoy}&estado=acreditado`);
    expect(api.llamadas.some((l) => l.clave.includes('estado=acreditado'))).toBe(true);
  });

  it('sin permiso de exportar no ofrece el botón', async () => {
    apiFalsa({
      'GET /auth/staff/yo': respuesta(200, yo(['reportes.ver'])),
      [`GET /reportes/resumen?desde=${hoy}&hasta=${hoy}`]: respuesta(200, resumen),
      [`GET /reportes/pedidos?desde=${hoy}&hasta=${hoy}&pagina=1`]: respuesta(200, { total: 0, pagina: 1, porPagina: 50, pedidos: [] }),
    });
    montar('/panel/reportes', <Reportes />);
    await screen.findByText('Ganancia', { selector: 'span' });
    expect(screen.queryByRole('link', { name: /Exportar/ })).not.toBeInTheDocument();
  });
});

const config: Config = {
  comision: { modo: 'recargo', porcentajePb: 500, impuestoPb: 0 },
  montos: { cargaMinima: 100_000, cargaMaxima: 50_000_000, retiroMinimo: 200_000, retiroConAprobacionDesde: 10_000_000 },
  cuentasPendientesMaximas: 3,
  retiro: { comisionPb: 0, diasSinCarga: 0 },
  pago: { alias: '', titular: '', banco: '' },
  horario: '',
  whatsapp: '',
  actualizadoEn: null,
};

describe('Configuración', () => {
  it('cambiar la comisión pide confirmación y guarda los valores en centavos y puntos básicos', async () => {
    const api = apiFalsa({
      'GET /auth/staff/yo': respuesta(200, yo(['configuracion.editar'])),
      'GET /configuracion': respuesta(200, config),
      'PUT /configuracion': (cuerpo) => respuesta(200, { ...config, ...(cuerpo as object), actualizadoEn: '2026-11-20T12:00:00Z' }),
    });
    montar('/panel/configuracion', <Configuracion />);
    const pct = await screen.findByLabelText('Porcentaje');
    await userEvent.clear(pct);
    await userEvent.type(pct, '7,5');
    expect(screen.getByText(/Ejemplo con/)).toHaveTextContent('transfiere $ 10.750');
    await userEvent.clear(screen.getByLabelText('Carga mínima'));
    await userEvent.type(screen.getByLabelText('Carga mínima'), '2.000');
    await userEvent.type(screen.getByLabelText('Alias o CBU'), 'carga24.pagos');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
    const modal = screen.getByRole('dialog', { name: '¿Cambiás la comisión?' });
    expect(api.enviado('PUT /configuracion')).toHaveLength(0);
    await userEvent.click(within(modal).getByRole('button', { name: 'Sí, cambiar' }));
    expect(await screen.findByText(/Configuración guardada/)).toBeInTheDocument();
    expect(api.enviado('PUT /configuracion')[0]).toMatchObject({
      comision: { modo: 'recargo', porcentajePb: 750, impuestoPb: 0 },
      montos: { cargaMinima: 200_000, cargaMaxima: 50_000_000 },
      pago: { alias: 'carga24.pagos' },
    });
  });

  it('no deja guardar un porcentaje inválido', async () => {
    apiFalsa({ 'GET /auth/staff/yo': respuesta(200, yo(['configuracion.editar'])), 'GET /configuracion': respuesta(200, config) });
    montar('/panel/configuracion', <Configuracion />);
    const pct = await screen.findByLabelText('Porcentaje');
    await userEvent.clear(pct);
    await userEvent.type(pct, '80');
    expect(screen.getByText('Entre 0 y 50')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar configuración' })).toBeDisabled();
  });
});
