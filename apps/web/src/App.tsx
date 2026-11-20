import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router';
import { CambiarContrasena } from './paginas/jugador/CambiarContrasena';
import { Ingresar } from './paginas/jugador/Ingresar';
import { Avisos } from './paginas/jugador/portal/Avisos';
import { Cargar } from './paginas/jugador/portal/Cargar';
import { Cuentas } from './paginas/jugador/portal/Cuentas';
import { Historial } from './paginas/jugador/portal/Historial';
import { Inicio } from './paginas/jugador/portal/Inicio';
import { Novedades } from './paginas/jugador/portal/Novedades';
import { PedidoDetalle } from './paginas/jugador/portal/PedidoDetalle';
import { Retirar } from './paginas/jugador/portal/Retirar';
import { Registro } from './paginas/jugador/Registro';
import { IngresoPanel } from './paginas/panel/IngresoPanel';
import { Cola } from './paginas/panel/cola/Cola';
import { InicioPanel } from './paginas/panel/InicioPanel';
import { JugadorDetalle } from './paginas/panel/JugadorDetalle';
import { Jugadores } from './paginas/panel/Jugadores';
import { Auditoria } from './paginas/panel/Auditoria';
import { Configuracion } from './paginas/panel/Configuracion';
import { MiCuenta } from './paginas/panel/MiCuenta';
import { Promociones } from './paginas/panel/Promociones';
import { Reportes } from './paginas/panel/Reportes';
import { NovedadesPanel } from './paginas/panel/NovedadesPanel';
import { PerfilEditor } from './paginas/panel/PerfilEditor';
import { Perfiles } from './paginas/panel/Perfiles';
import { Staff } from './paginas/panel/Staff';
import { StaffDetalle } from './paginas/panel/StaffDetalle';
import { ProveedorPortalEnVivo } from './sesion/portalEnVivo';
import { ProveedorSesionJugador, ProveedorSesionStaff, RutaJugador, RutaStaff } from './sesion/sesion';

/** El mismo build sirve carga24.com.ar (jugador) y panel.carga24.com.ar (staff). */
export function esDominioPanel(host = window.location.hostname): boolean {
  return host.startsWith('panel.');
}

/** En desarrollo (localhost) el panel también se abre en /panel. */
function usarPanel(): boolean {
  return esDominioPanel() || (import.meta.env.DEV && window.location.pathname.startsWith('/panel'));
}

function RutasJugador() {
  return (
    <ProveedorSesionJugador>
      <Routes>
        <Route path="/ingresar" element={<Ingresar />} />
        <Route path="/registro" element={<Registro />} />
        <Route element={<RutaJugador />}>
          <Route path="/cambiar-contrasena" element={<CambiarContrasena />} />
          <Route
            element={
              <ProveedorPortalEnVivo>
                <Outlet />
              </ProveedorPortalEnVivo>
            }
          >
            <Route path="/inicio" element={<Inicio />} />
            <Route path="/cargar" element={<Cargar />} />
            <Route path="/retirar" element={<Retirar />} />
            <Route path="/historial" element={<Historial />} />
            <Route path="/pedidos/:id" element={<PedidoDetalle />} />
            <Route path="/cuentas" element={<Cuentas />} />
            <Route path="/novedades" element={<Novedades />} />
            <Route path="/avisos" element={<Avisos />} />
          </Route>
        </Route>
        {/* La landing se suma en un próximo PR; por ahora la raíz lleva al ingreso. */}
        <Route path="*" element={<Navigate to="/inicio" replace />} />
      </Routes>
    </ProveedorSesionJugador>
  );
}

function RutasPanel() {
  return (
    <ProveedorSesionStaff>
      <Routes>
        <Route path="/panel/ingresar" element={<IngresoPanel />} />
        <Route element={<RutaStaff />}>
          <Route path="/panel" element={<InicioPanel />} />
          <Route path="/panel/cola" element={<Cola />} />
          <Route path="/panel/jugadores" element={<Jugadores />} />
          <Route path="/panel/jugadores/:id" element={<JugadorDetalle />} />
          <Route path="/panel/staff" element={<Staff />} />
          <Route path="/panel/staff/:id" element={<StaffDetalle />} />
          <Route path="/panel/perfiles" element={<Perfiles />} />
          <Route path="/panel/perfiles/nuevo" element={<PerfilEditor />} />
          <Route path="/panel/perfiles/:id" element={<PerfilEditor />} />
          <Route path="/panel/novedades" element={<NovedadesPanel />} />
          <Route path="/panel/reportes" element={<Reportes />} />
          <Route path="/panel/promociones" element={<Promociones />} />
          <Route path="/panel/configuracion" element={<Configuracion />} />
          <Route path="/panel/auditoria" element={<Auditoria />} />
          <Route path="/panel/mi-cuenta" element={<MiCuenta />} />
        </Route>
        <Route path="*" element={<Navigate to="/panel" replace />} />
      </Routes>
    </ProveedorSesionStaff>
  );
}

export function App() {
  return (
    <BrowserRouter>
      {usarPanel() ? <RutasPanel /> : <RutasJugador />}
    </BrowserRouter>
  );
}
