import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProveedorSesionStaff } from '../../sesion/sesion';
import { apiFalsa, respuesta } from '../../test/apiFalsa';
import { IngresoPanel } from './IngresoPanel';

vi.mock('qrcode', () => ({ default: { toDataURL: () => Promise.resolve('data:image/png;base64,QR') } }));

function montar() {
  render(
    <MemoryRouter initialEntries={['/panel/ingresar']}>
      <ProveedorSesionStaff>
        <Routes>
          <Route path="/panel/ingresar" element={<IngresoPanel />} />
          <Route path="/panel" element={<p>Panel adentro</p>} />
        </Routes>
      </ProveedorSesionStaff>
    </MemoryRouter>,
  );
}

const staff = { id: 's1', nombreUsuario: 'laura', nombreVisible: 'Laura', perfil: { id: 'p', nombre: 'Operador' }, permisos: ['pedidos.ver'] };

describe('Ingreso al panel', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('primer ingreso: contraseña temporal → contraseña nueva → QR → código', async () => {
    apiFalsa({
      'GET /auth/staff/yo': respuesta(401, { mensaje: 'Tenés que iniciar sesión' }),
      'GET /auth/staff/estado': respuesta(401, { mensaje: 'Tenés que iniciar sesión' }),
      'POST /auth/staff/ingreso': respuesta(200, { siguientePaso: 'cambiar_contrasena' }),
      'POST /auth/staff/contrasena-inicial': respuesta(200, { siguientePaso: 'configurar_2fa' }),
      'POST /auth/staff/2fa/configurar': respuesta(200, { secreto: 'ABCDEF234567', uri: 'otpauth://totp/x' }),
      'POST /auth/staff/2fa/activar': respuesta(200, staff),
    });
    montar();

    await userEvent.type(await screen.findByLabelText('Usuario'), 'laura');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'K7M-29QX');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    await userEvent.type(await screen.findByLabelText('Contraseña nueva'), 'clave-de-laura');
    await userEvent.type(screen.getByLabelText('Repetí la contraseña nueva'), 'clave-de-laura');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByAltText('Código QR para la app de autenticación')).toHaveAttribute('src', 'data:image/png;base64,QR');
    expect(screen.getByText('ABCDEF234567')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Código de 6 dígitos'), '12a3456');
    expect(screen.getByLabelText('Código de 6 dígitos')).toHaveValue('123456');
    await userEvent.click(screen.getByRole('button', { name: 'Activar e ingresar' }));
    expect(await screen.findByText('Panel adentro')).toBeInTheDocument();
  });

  it('sin 2FA en el servidor (DOS_FACTORES=no) entra con la contraseña', async () => {
    let adentro = false;
    apiFalsa({
      'GET /auth/staff/yo': () => (adentro ? respuesta(200, staff) : respuesta(401, { mensaje: 'Tenés que iniciar sesión' })),
      'GET /auth/staff/estado': respuesta(401, { mensaje: 'Tenés que iniciar sesión' }),
      'POST /auth/staff/ingreso': () => {
        adentro = true;
        return respuesta(200, { siguientePaso: 'listo' });
      },
    });
    montar();
    await userEvent.type(await screen.findByLabelText('Usuario'), 'laura');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave-de-laura');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Panel adentro')).toBeInTheDocument();
  });

  it('avisa si las contraseñas no coinciden', async () => {
    apiFalsa({
      'GET /auth/staff/yo': respuesta(401, {}),
      'GET /auth/staff/estado': respuesta(200, { siguientePaso: 'cambiar_contrasena' }),
    });
    montar();
    await userEvent.type(await screen.findByLabelText('Contraseña nueva'), 'clave-de-laura');
    await userEvent.type(screen.getByLabelText('Repetí la contraseña nueva'), 'otra-clave');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Las contraseñas no coinciden')).toBeInTheDocument();
  });

  it('un código incorrecto muestra el error y limpia el campo', async () => {
    apiFalsa({
      'GET /auth/staff/yo': respuesta(401, {}),
      'GET /auth/staff/estado': respuesta(200, { siguientePaso: 'verificar_2fa' }),
      'POST /auth/staff/2fa/verificar': respuesta(400, { mensaje: 'El código no es correcto.' }),
    });
    montar();
    await userEvent.type(await screen.findByLabelText('Código de 6 dígitos'), '000000');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El código no es correcto.');
    expect(screen.getByLabelText('Código de 6 dígitos')).toHaveValue('');
  });
});
