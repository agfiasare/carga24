import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProveedorSesionJugador } from '../sesion/sesion';
import { apiFalsa, respuesta } from '../test/apiFalsa';
import { Landing } from './Landing';

function montar() {
  render(
    <MemoryRouter>
      <ProveedorSesionJugador>
        <Landing />
      </ProveedorSesionJugador>
    </MemoryRouter>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('Landing', () => {
  it('muestra horario, WhatsApp, la promo vigente y lleva a crear la cuenta', async () => {
    apiFalsa({
      'GET /yo': respuesta(401, {}),
      'GET /publico/landing': respuesta(200, {
        horario: 'todos los días de 10 a 2',
        whatsapp: '5491155550000',
        plataforma: 'Casino Uno',
        promo: { id: 'p', titulo: 'Finde 10% extra', condiciones: 'De viernes a domingo', codigo: 'FINDE10', hasta: '2026-11-23T02:59:59Z' },
      }),
    });
    montar();
    expect(await screen.findByText('Atención todos los días de 10 a 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cargá saldo y cobrá tus premios, sin vueltas.');
    expect(screen.getByRole('link', { name: 'Pedir por WhatsApp' })).toHaveAttribute('href', 'https://wa.me/5491155550000');
    for (const enlace of screen.getAllByRole('link', { name: /Crear mi cuenta/ })) expect(enlace).toHaveAttribute('href', '/registro');
    expect(screen.getByText('FINDE10')).toBeInTheDocument();
    expect(screen.getByText(/Tu usuario de Casino Uno/)).toBeInTheDocument();
  });

  it('las preguntas se abren de a una', async () => {
    apiFalsa({ 'GET /yo': respuesta(401, {}), 'GET /publico/landing': respuesta(200, { horario: '', whatsapp: '', plataforma: null, promo: null }) });
    montar();
    const segunda = await screen.findByRole('button', { name: /¿Tengo que mandar comprobante\?/ });
    expect(segunda).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(segunda);
    expect(segunda).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/ya está verificada: lo vemos en el banco/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /¿Cuánto tarda/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Pedir por WhatsApp' })).not.toBeInTheDocument();
  });

  it('con sesión iniciada ofrece ir a la cuenta', async () => {
    apiFalsa({
      'GET /yo': respuesta(200, { id: 'j', nombreUsuario: 'ana', telefono: null, usuarioPlataforma: 'a', debeCambiarContrasena: false }),
      'GET /publico/landing': respuesta(200, { horario: '', whatsapp: '', plataforma: null, promo: null }),
    });
    montar();
    expect((await screen.findAllByRole('link', { name: /Ir a mi cuenta/ }))[0]).toHaveAttribute('href', '/inicio');
    expect(screen.queryByRole('link', { name: 'Ingresar' })).not.toBeInTheDocument();
  });
});
