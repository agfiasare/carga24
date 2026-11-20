import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { CambiarContrasena } from './paginas/jugador/CambiarContrasena';
import { Ingresar } from './paginas/jugador/Ingresar';
import { Inicio } from './paginas/jugador/Inicio';
import { Registro } from './paginas/jugador/Registro';
import { IngresoPanel } from './paginas/panel/IngresoPanel';
import { InicioPanel } from './paginas/panel/InicioPanel';
import { JugadorDetalle } from './paginas/panel/JugadorDetalle';
import { Jugadores } from './paginas/panel/Jugadores';
import { MiCuenta } from './paginas/panel/MiCuenta';
import { PerfilEditor } from './paginas/panel/PerfilEditor';
import { Perfiles } from './paginas/panel/Perfiles';
import { Staff } from './paginas/panel/Staff';
import { StaffDetalle } from './paginas/panel/StaffDetalle';
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
          <Route path="/inicio" element={<Inicio />} />
          <Route path="/cambiar-contrasena" element={<CambiarContrasena />} />
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
          <Route path="/panel/jugadores" element={<Jugadores />} />
          <Route path="/panel/jugadores/:id" element={<JugadorDetalle />} />
          <Route path="/panel/staff" element={<Staff />} />
          <Route path="/panel/staff/:id" element={<StaffDetalle />} />
          <Route path="/panel/perfiles" element={<Perfiles />} />
          <Route path="/panel/perfiles/nuevo" element={<PerfilEditor />} />
          <Route path="/panel/perfiles/:id" element={<PerfilEditor />} />
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
