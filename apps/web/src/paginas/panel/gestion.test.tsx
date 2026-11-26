import { PERFILES_INICIALES } from '@carga24/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProveedorSesionStaff } from '../../sesion/sesion';
import { apiFalsa, respuesta } from '../../test/apiFalsa';
import { JugadorDetalle } from './JugadorDetalle';
import { Jugadores } from './Jugadores';
import { PerfilEditor } from './PerfilEditor';
import { StaffDetalle } from './StaffDetalle';

const OPERADOR = PERFILES_INICIALES.Operador ?? [];
const yoAdmin = { id: 'adm', nombreUsuario: 'admin', nombreVisible: 'Admin', perfil: { id: 'p-admin', nombre: 'Admin' }, permisos: ['jugadores.ver', 'jugadores.crear', 'jugadores.editar', 'jugadores.bloquear', 'jugadores.resetear_contrasena', 'staff.gestionar', 'perfiles.gestionar'] };
const yoOperador = { ...yoAdmin, id: 'op', nombreVisible: 'Laura', perfil: { id: 'p-op', nombre: 'Operador' }, permisos: OPERADOR };
const ana = { id: 'j1', nombreUsuario: 'ana', telefono: '5491144441234', usuarioPlataforma: 'ana99', estado: 'activo', debeCambiarContrasena: false, creadoEn: '2026-11-20T00:00:00Z', notasInternas: null };
const perfilesLista = [
  { id: 'p-admin', nombre: 'Admin', descripcion: null, permisos: yoAdmin.permisos, cantidadUsuarios: 1 },
  { id: 'p-op', nombre: 'Operador', descripcion: null, permisos: OPERADOR, cantidadUsuarios: 1 },
];
const laura = {
  id: 'op', nombreUsuario: 'laura', nombreVisible: 'Laura', estado: 'activo', perfil: { id: 'p-op', nombre: 'Operador' }, ajustes: [],
  permisos: OPERADOR, tiene2fa: true, debeCambiarContrasena: false, comisionOperadorPb: null, creadoEn: '2026-11-20T00:00:00Z',
};

function montar(ruta: string, patron: string, elemento: React.ReactNode) {
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorSesionStaff>
        <Routes>
          <Route path={patron} element={elemento} />
          <Route path="*" element={<p>Otra página</p>} />
        </Routes>
      </ProveedorSesionStaff>
    </MemoryRouter>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('Jugadores', () => {
  it('lista, busca y crea un jugador mostrando la contraseña temporal una vez', async () => {
    const api = apiFalsa({
      'GET /auth/staff/yo': respuesta(200, yoAdmin),
      'GET /jugadores?pagina=1': respuesta(200, { total: 1, pagina: 1, porPagina: 50, jugadores: [ana] }),
      'GET /jugadores?buscar=juan&pagina=1': respuesta(200, { total: 0, pagina: 1, porPagina: 50, jugadores: [] }),
      'POST /jugadores': respuesta(201, { jugador: { ...ana, id: 'j2', nombreUsuario: null, telefono: '5491155550001' }, contrasenaTemporal: 'K7M-29QX' }),
    });
    montar('/panel/jugadores', '/panel/jugadores', <Jugadores />);

    expect(await screen.findByRole('link', { name: 'ana' })).toHaveAttribute('href', '/panel/jugadores/j1');
    expect(screen.getByText('+54 9 11 4444-1234')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Buscar jugadores'), 'juan');
    expect(await screen.findByText('No hay jugadores que coincidan con “juan”.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Nuevo jugador' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nuevo jugador' });
    await userEvent.type(within(dialogo).getByLabelText('Usuario en la plataforma'), 'juan_casino');
    await userEvent.type(within(dialogo).getByLabelText('Teléfono'), '11 5555 0001');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Crear jugador' }));

    expect(api.enviado('POST /jugadores')).toEqual([{ usuarioPlataforma: 'juan_casino', telefono: '11 5555 0001' }]);
    const temporal = await screen.findByRole('dialog', { name: 'Contraseña temporal' });
    expect(within(temporal).getByText('K7M-29QX')).toBeInTheDocument();
    await userEvent.click(within(temporal).getByRole('button', { name: 'Listo, ya la pasé' }));
    expect(await screen.findByText('Otra página')).toBeInTheDocument(); // fue al detalle del jugador nuevo
  });

  it('sin permiso de crear no muestra el botón', async () => {
    apiFalsa({
      'GET /auth/staff/yo': respuesta(200, { ...yoOperador, permisos: ['jugadores.ver'] }),
      'GET /jugadores?pagina=1': respuesta(200, { total: 0, pagina: 1, porPagina: 50, jugadores: [] }),
    });
    montar('/panel/jugadores', '/panel/jugadores', <Jugadores />);
    expect(await screen.findByText('Todavía no hay jugadores.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuevo jugador' })).not.toBeInTheDocument();
  });

  it('sin el permiso de ver, avisa en lugar de mostrar la sección', async () => {
    apiFalsa({ 'GET /auth/staff/yo': respuesta(200, { ...yoOperador, permisos: [] }) });
    montar('/panel/jugadores', '/panel/jugadores', <Jugadores />);
    expect(await screen.findByText(/No tenés permiso para ver esta sección/)).toBeInTheDocument();
  });
});

describe('Detalle de jugador', () => {
  it('guarda solo lo que cambió y bloquea con confirmación', async () => {
    const api = apiFalsa({
      'GET /auth/staff/yo': respuesta(200, yoAdmin),
      'GET /jugadores/j1': respuesta(200, ana),
      'PATCH /jugadores/j1': (cuerpo) => respuesta(200, { ...ana, ...(cuerpo as object) }),
      'POST /jugadores/j1/bloquear': respuesta(200, { ...ana, estado: 'bloqueado' }),
    });
    montar('/panel/jugadores/j1', '/panel/jugadores/:id', <JugadorDetalle />);

    const notas = await screen.findByLabelText('Notas internas (solo las ve el staff)');
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    await userEvent.type(notas, 'Paga siempre a la noche');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Cambios guardados.')).toBeInTheDocument();
    expect(api.enviado('PATCH /jugadores/j1')).toEqual([{ notasInternas: 'Paga siempre a la noche' }]);

    await userEvent.click(screen.getByRole('button', { name: 'Bloquear' }));
    const confirmar = screen.getByRole('dialog', { name: 'Bloquear a ana' });
    expect(api.enviado('POST /jugadores/j1/bloquear')).toHaveLength(0); // nada sin confirmar
    await userEvent.click(within(confirmar).getByRole('button', { name: 'Bloquear' }));
    expect(await screen.findByText('Bloqueado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desbloquear' })).toBeInTheDocument();
  });

  it('muestra sus pedidos con totales, también los rechazados', async () => {
    const ahora = new Date().toISOString();
    apiFalsa({
      'GET /auth/staff/yo': respuesta(200, { ...yoAdmin, permisos: [...yoAdmin.permisos, 'pedidos.ver'] }),
      'GET /jugadores/j1': respuesta(200, ana),
      'GET /jugadores/j1/pedidos': respuesta(200, {
        totales: { cargas: { cantidad: 1, monto: 1_000_000 }, retiros: { cantidad: 0, monto: 0 }, ganancia: 50_000, rechazados: 1, enCurso: 0, pedidos: 2 },
        pedidos: [
          { id: 8, tipo: 'carga', estado: 'rechazado', canal: 'web', monto: 500_000, montoPagado: 525_000, ganancia: 0, motivoRechazo: 'El pago no llegó', creadoEn: ahora, ejecutadoEn: null, operador: 'Laura' },
          { id: 7, tipo: 'carga', estado: 'acreditado', canal: 'manual', monto: 1_000_000, montoPagado: 1_050_000, ganancia: 50_000, motivoRechazo: null, creadoEn: ahora, ejecutadoEn: ahora, operador: 'Laura' },
        ],
      }),
    });
    montar('/panel/jugadores/j1', '/panel/jugadores/:id', <JugadorDetalle />);
    const seccion = await screen.findByRole('region', { name: 'Pedidos' });
    expect(await within(seccion).findByText('Carga #8')).toBeInTheDocument();
    expect(within(seccion).getByText('El pago no llegó')).toBeInTheDocument();
    expect(within(seccion).getByText('Cargado').nextSibling).toHaveTextContent('$ 10.000');
    await userEvent.click(within(seccion).getByRole('button', { name: 'Rechazados' }));
    expect(within(seccion).queryByText('Carga #7')).not.toBeInTheDocument();
    expect(within(seccion).getByText('Carga #8')).toBeInTheDocument();
  });
});

describe('Detalle de staff', () => {
  it('los permisos se guardan como ajustes sobre el perfil', async () => {
    const api = apiFalsa({
      'GET /auth/staff/yo': respuesta(200, yoAdmin),
      'GET /staff/op': respuesta(200, laura),
      'GET /perfiles': respuesta(200, perfilesLista),
      'PUT /staff/op/ajustes': (cuerpo) => respuesta(200, { ...laura, ajustes: (cuerpo as { ajustes: unknown[] }).ajustes, permisos: [...OPERADOR.filter((p) => p !== 'pedidos.rechazar'), 'jugadores.bloquear'] }),
    });
    montar('/panel/staff/op', '/panel/staff/:id', <StaffDetalle />);

    await userEvent.click(await screen.findByLabelText('Bloquear jugadores'));
    await userEvent.click(screen.getByLabelText('Rechazar pedidos'));
    expect(screen.getByText('Agregado')).toBeInTheDocument();
    expect(screen.getByText('Quitado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar permisos' }));
    expect(await screen.findByText(/Permisos guardados/)).toBeInTheDocument();
    expect(api.enviado('PUT /staff/op/ajustes')).toEqual([
      { ajustes: [{ permiso: 'jugadores.bloquear', tipo: 'agregar' }, { permiso: 'pedidos.rechazar', tipo: 'quitar' }] },
    ]);
  });

  it('sin el permiso de gestionar staff no muestra la ficha', async () => {
    apiFalsa({
      'GET /auth/staff/yo': respuesta(200, yoOperador),
      'GET /staff/op': respuesta(200, laura),
      'GET /perfiles': respuesta(200, perfilesLista),
    });
    montar('/panel/staff/op', '/panel/staff/:id', <StaffDetalle />);
    expect(await screen.findByText(/No tenés permiso/)).toBeInTheDocument();
  });

  it('un admin viendo su propia ficha la ve en solo lectura', async () => {
    apiFalsa({
      'GET /auth/staff/yo': respuesta(200, yoAdmin),
      'GET /staff/adm': respuesta(200, { ...laura, id: 'adm', nombreVisible: 'Admin', perfil: { id: 'p-admin', nombre: 'Admin' }, permisos: yoAdmin.permisos }),
      'GET /perfiles': respuesta(200, perfilesLista),
    });
    montar('/panel/staff/adm', '/panel/staff/:id', <StaffDetalle />);
    expect(await screen.findByText(/Es tu cuenta/)).toBeInTheDocument();
    expect(screen.getByLabelText('Perfil')).toBeDisabled();
    expect(screen.getByLabelText('Ver jugadores')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Guardar permisos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bloquear' })).not.toBeInTheDocument();
  });
});

describe('Editor de perfiles', () => {
  it('crea un perfil con los permisos elegidos', async () => {
    const api = apiFalsa({
      'GET /auth/staff/yo': respuesta(200, yoAdmin),
      'GET /perfiles': respuesta(200, perfilesLista),
      'POST /perfiles': respuesta(201, { id: 'p-nuevo' }),
    });
    montar('/panel/perfiles/nuevo', '/panel/perfiles/nuevo', <PerfilEditor />);
    await userEvent.type(await screen.findByLabelText('Nombre del perfil'), 'Cajero');
    await userEvent.click(screen.getByLabelText('Marcar retiros como pagados'));
    await userEvent.click(screen.getByLabelText('Ver la cola y el historial'));
    await userEvent.click(screen.getByRole('button', { name: 'Crear perfil' }));
    expect(await screen.findByText('Otra página')).toBeInTheDocument();
    expect(api.enviado('POST /perfiles')).toEqual([{ nombre: 'Cajero', descripcion: null, permisos: ['pedidos.pagar', 'pedidos.ver'] }]);
  });

  it('el perfil propio queda en solo lectura y uno en uso no se puede borrar', async () => {
    apiFalsa({ 'GET /auth/staff/yo': respuesta(200, yoAdmin), 'GET /perfiles': respuesta(200, perfilesLista) });
    montar('/panel/perfiles/p-admin', '/panel/perfiles/:id', <PerfilEditor />);
    expect(await screen.findByText(/Es el perfil que tenés asignado/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar perfil' })).not.toBeInTheDocument();
  });

  it('muestra el error de la API (por ejemplo, si nadie quedaría administrando)', async () => {
    apiFalsa({
      'GET /auth/staff/yo': respuesta(200, yoAdmin),
      'GET /perfiles': respuesta(200, perfilesLista),
      'PUT /perfiles/p-op': respuesta(409, { mensaje: 'Con este cambio nadie podría administrar el staff y los perfiles.' }),
    });
    montar('/panel/perfiles/p-op', '/panel/perfiles/:id', <PerfilEditor />);
    expect(screen.queryByRole('button', { name: 'Borrar perfil' })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar perfil' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('nadie podría administrar');
    expect(screen.getByRole('button', { name: 'Borrar perfil' })).toBeDisabled();
  });
});
