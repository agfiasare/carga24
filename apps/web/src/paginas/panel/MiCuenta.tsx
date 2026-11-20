import { useState } from 'react';
import { authStaff } from '../../api/auth';
import { Aviso } from '../../componentes';
import { useSesionStaff } from '../../sesion/sesion';
import { CambioContrasena } from '../CambioContrasena';
import { PaginaPanel } from './PaginaPanel';
import clases from './panel.module.css';

export function MiCuenta() {
  const { usuario } = useSesionStaff();
  const [listo, setListo] = useState(false);
  const [clave, setClave] = useState(0);
  return (
    <PaginaPanel titulo="Mi cuenta">
      <div className={clases.columnas}>
        <section className={clases.tarjeta} aria-labelledby="titulo-contrasena">
          <h2 id="titulo-contrasena">Cambiar contraseña</h2>
          <p className={clases.explicacion}>Al cambiarla se cierran tus sesiones en otros dispositivos.</p>
          {listo ? <Aviso tipo="ok">Listo, tu contraseña quedó cambiada.</Aviso> : null}
          <CambioContrasena
            key={clave}
            guardar={authStaff.cambiarContrasena}
            alTerminar={() => {
              setListo(true);
              setClave((c) => c + 1);
            }}
          />
        </section>
        <section className={clases.tarjeta} aria-labelledby="titulo-datos">
          <h2 id="titulo-datos">Tus datos</h2>
          <dl className={clases.datos}>
            <dt>Usuario</dt>
            <dd>{usuario?.nombreUsuario}</dd>
            <dt>Perfil</dt>
            <dd>{usuario?.perfil?.nombre ?? '—'}</dd>
            <dt>Permisos</dt>
            <dd>{usuario?.permisos.length}</dd>
          </dl>
          <p className={clases.explicacion}>Si perdés el celular con el código de verificación, pedí que te reseteen el 2FA.</p>
        </section>
      </div>
    </PaginaPanel>
  );
}
