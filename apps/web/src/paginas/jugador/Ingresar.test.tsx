import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProveedorSesionJugador } from '../../sesion/sesion';
import { Ingresar } from './Ingresar';

function respuesta(status: number, cuerpo?: unknown): Response {
  return new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
}

function montar() {
  render(
    <MemoryRouter initialEntries={['/ingresar']}>
      <ProveedorSesionJugador>
        <Routes>
          <Route path="/ingresar" element={<Ingresar />} />
          <Route path="/inicio" element={<p>Pantalla de inicio</p>} />
          <Route path="/cambiar-contrasena" element={<p>Cambiar contraseña</p>} />
        </Routes>
      </ProveedorSesionJugador>
    </MemoryRouter>,
  );
}

const jugador = { id: 'j1', nombreUsuario: 'juanp', telefono: '5491155550001', usuarioPlataforma: 'juan', debeCambiarContrasena: false };

describe('Ingresar (jugador)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('muestra el error de la API', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(respuesta(401, { mensaje: 'Tenés que iniciar sesión' })) // GET /yo al montar
      .mockResolvedValueOnce(respuesta(401, { mensaje: 'Usuario o contraseña incorrectos' }));
    vi.stubGlobal('fetch', fetch);
    montar();
    await userEvent.type(screen.getByLabelText('Teléfono o usuario'), 'juanp');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'mala');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario o contraseña incorrectos');
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/v1/auth/jugador/ingreso',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ identificador: 'juanp', contrasena: 'mala' }) }),
    );
  });

  it('al ingresar va al inicio, o a cambiar la contraseña si es temporal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(respuesta(401, {})).mockResolvedValueOnce(respuesta(200, jugador)));
    montar();
    await userEvent.type(screen.getByLabelText('Teléfono o usuario'), 'juanp');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'buena-clave');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByText('Pantalla de inicio')).toBeInTheDocument();
  });

  it('con contraseña temporal lleva a cambiarla', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(respuesta(401, {})).mockResolvedValueOnce(respuesta(200, { ...jugador, debeCambiarContrasena: true })),
    );
    montar();
    await userEvent.type(screen.getByLabelText('Teléfono o usuario'), '1155550001');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'K7M-29QX');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByText('Cambiar contraseña')).toBeInTheDocument();
  });
});
