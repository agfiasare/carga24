import { KeyRound, ShieldCheck, User } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { authStaff, type PasoIngresoStaff, type StaffYo } from '../../api/auth';
import { useAccion } from '../../api/useAccion';
import { Aviso, Boton, CampoFormulario, PlantillaAcceso } from '../../componentes';
import { useSesionStaff } from '../../sesion/sesion';
import { CambioContrasena } from '../CambioContrasena';
import clases from '../formularios.module.css';

type Paso = 'credenciales' | PasoIngresoStaff;

const TITULOS: Record<Paso, { titulo: string; bajada: string }> = {
  credenciales: { titulo: 'Ingreso del staff', bajada: 'Con tu usuario y contraseña del panel.' },
  cambiar_contrasena: { titulo: 'Elegí tu contraseña', bajada: 'Estás usando una contraseña temporal. Elegí una tuya, de al menos 8 caracteres.' },
  configurar_2fa: { titulo: 'Activá la verificación en dos pasos', bajada: 'El panel pide un código de tu celular cada vez que ingresás.' },
  verificar_2fa: { titulo: 'Código de verificación', bajada: 'Abrí tu app de autenticación y escribí el código de 6 dígitos de Carga24.' },
};

/** Ingreso al panel en pasos: credenciales → (contraseña nueva) → (configurar 2FA) → código. */
export function IngresoPanel() {
  const { usuario, establecer } = useSesionStaff();
  const navegar = useNavigate();
  const [paso, setPaso] = useState<Paso | null>(null);

  // Si se recarga la página a mitad del ingreso, se retoma donde quedó.
  useEffect(() => {
    // Si la respuesta llega tarde, no pisa el paso al que ya avanzó la persona.
    authStaff
      .estado()
      .then((r) => setPaso((actual) => actual ?? r.siguientePaso))
      .catch(() => setPaso((actual) => actual ?? 'credenciales'));
  }, []);

  if (usuario) return <Navigate to="/panel" replace />;
  if (paso === null) return null;

  function completar(staff: StaffYo) {
    establecer(staff);
    navegar('/panel', { replace: true });
  }

  async function cancelar() {
    await authStaff.salir().catch(() => undefined);
    setPaso('credenciales');
  }

  const cancelarBoton =
    paso === 'credenciales' ? null : (
      <Boton variante="fantasma" onClick={() => void cancelar()}>
        Cancelar e ingresar con otra cuenta
      </Boton>
    );

  return (
    <PlantillaAcceso marca="Panel del staff" titulo={TITULOS[paso].titulo} bajada={TITULOS[paso].bajada} pie={cancelarBoton}>
      {paso === 'credenciales' ? <Credenciales alContinuar={setPaso} /> : null}
      {paso === 'cambiar_contrasena' ? (
        <CambioContrasena
          pedirActual={false}
          textoBoton="Continuar"
          guardar={async (_actual, nueva) => setPaso((await authStaff.contrasenaInicial(nueva)).siguientePaso)}
          alTerminar={() => undefined}
        />
      ) : null}
      {paso === 'configurar_2fa' ? <Configurar2fa alCompletar={completar} /> : null}
      {paso === 'verificar_2fa' ? <CodigoVerificacion enviarCodigo={authStaff.verificar2fa} alCompletar={completar} /> : null}
    </PlantillaAcceso>
  );
}

function Credenciales({ alContinuar }: { alContinuar: (paso: PasoIngresoStaff) => void }) {
  const [identificador, setIdentificador] = useState('');
  const [contrasena, setContrasena] = useState('');
  const { ejecutar, cargando, error } = useAccion(authStaff.ingresar);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const resultado = await ejecutar(identificador, contrasena);
    if (resultado) alContinuar(resultado.valor.siguientePaso);
  }

  return (
    <form className={clases.formulario} onSubmit={enviar} noValidate>
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      <CampoFormulario
        etiqueta="Usuario"
        icono={<User size={18} />}
        autoComplete="username"
        value={identificador}
        onChange={(e) => setIdentificador(e.target.value)}
      />
      <CampoFormulario
        etiqueta="Contraseña"
        type="password"
        icono={<KeyRound size={18} />}
        autoComplete="current-password"
        value={contrasena}
        onChange={(e) => setContrasena(e.target.value)}
      />
      <Boton type="submit" tamano="lg" anchoCompleto cargando={cargando} disabled={!identificador || !contrasena}>
        Continuar
      </Boton>
    </form>
  );
}

function Configurar2fa({ alCompletar }: { alCompletar: (staff: StaffYo) => void }) {
  const [datos, setDatos] = useState<{ secreto: string; qr: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    authStaff
      .configurar2fa()
      .then(async ({ secreto, uri }) => {
        const qr = await QRCode.toDataURL(uri, { margin: 1, width: 400 });
        if (vigente) setDatos({ secreto, qr });
      })
      .catch((e: Error) => vigente && setError(e.message));
    return () => {
      vigente = false;
    };
  }, []);

  if (error) return <Aviso tipo="error">{error}</Aviso>;
  if (!datos) return null;

  return (
    <>
      <ol className={clases.pasos}>
        <li>Instalá Google Authenticator, Microsoft Authenticator o similar.</li>
        <li>Escaneá este código con la app.</li>
        <li>Escribí el código de 6 dígitos que te muestra.</li>
      </ol>
      <img src={datos.qr} alt="Código QR para la app de autenticación" className={clases.qr} />
      <details>
        <summary>¿No podés escanearlo? Cargá esta clave a mano</summary>
        <p className={clases.secreto}>{datos.secreto}</p>
      </details>
      <CodigoVerificacion enviarCodigo={authStaff.activar2fa} alCompletar={alCompletar} textoBoton="Activar e ingresar" />
    </>
  );
}

function CodigoVerificacion({
  enviarCodigo,
  alCompletar,
  textoBoton = 'Ingresar',
}: {
  enviarCodigo: (codigo: string) => Promise<StaffYo>;
  alCompletar: (staff: StaffYo) => void;
  textoBoton?: string;
}) {
  const [codigo, setCodigo] = useState('');
  const { ejecutar, cargando, error } = useAccion(enviarCodigo);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const resultado = await ejecutar(codigo);
    if (resultado) alCompletar(resultado.valor);
    else setCodigo('');
  }

  return (
    <form className={clases.formulario} onSubmit={enviar} noValidate>
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      <CampoFormulario
        etiqueta="Código de 6 dígitos"
        icono={<ShieldCheck size={18} />}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
      />
      <Boton type="submit" tamano="lg" anchoCompleto cargando={cargando} disabled={codigo.length !== 6}>
        {textoBoton}
      </Boton>
    </form>
  );
}
