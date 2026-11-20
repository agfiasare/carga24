import type { Permiso } from '@carga24/shared';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { calcularAjustes, perfiles, staff, type Perfil, type StaffPanel } from '../../api/gestion';
import { useAccion } from '../../api/useAccion';
import { useConsulta } from '../../api/useConsulta';
import { formatearFecha } from '../../comun/formato';
import { Aviso, Boton, CampoFormulario, ContrasenaTemporal, ModalConfirmacion, SelectorFormulario, SelectorPermisos } from '../../componentes';
import { useSesionStaff } from '../../sesion/sesion';
import { PaginaPanel } from './PaginaPanel';
import { EstadoStaff } from './Staff';
import clases from './panel.module.css';

export function StaffDetalle() {
  const { id = '' } = useParams();
  const { usuario, recargar } = useSesionStaff();
  const { datos: persona, setDatos, error } = useConsulta(() => staff.obtener(id), [id]);
  const { datos: listaPerfiles } = useConsulta(perfiles.listar, []);
  const esUnoMismo = persona?.id === usuario?.id;

  function actualizar(nueva: StaffPanel) {
    setDatos(nueva);
    if (esUnoMismo) void recargar();
  }

  return (
    <PaginaPanel titulo={persona?.nombreVisible ?? persona?.nombreUsuario ?? 'Staff'} requiere={['staff.gestionar']} volver={<Link to="/panel/staff">← Staff</Link>}>
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      {esUnoMismo ? <Aviso tipo="info">Es tu cuenta. Tu perfil, tus permisos y tu estado los cambia otra persona con permiso para gestionar el staff.</Aviso> : null}
      {persona && listaPerfiles ? (
        <>
          <div className={clases.columnas}>
            <DatosStaff key={persona.id} persona={persona} perfiles={listaPerfiles} esUnoMismo={esUnoMismo} alGuardar={actualizar} />
            <Seguridad persona={persona} esUnoMismo={esUnoMismo} alCambiar={actualizar} />
          </div>
          <Permisos key={`${persona.id}-${persona.perfil?.id ?? ''}`} persona={persona} perfiles={listaPerfiles} esUnoMismo={esUnoMismo} alGuardar={actualizar} />
        </>
      ) : null}
    </PaginaPanel>
  );
}

interface SeccionProps {
  persona: StaffPanel;
  esUnoMismo: boolean;
  alGuardar: (p: StaffPanel) => void;
}

function DatosStaff({ persona, perfiles: lista, esUnoMismo, alGuardar }: SeccionProps & { perfiles: Perfil[] }) {
  const inicial = {
    nombreVisible: persona.nombreVisible ?? '',
    perfilId: persona.perfil?.id ?? '',
    comision: persona.comisionOperadorPb === null ? '' : String(persona.comisionOperadorPb / 100),
  };
  const [datos, setDatos] = useState(inicial);
  const [guardado, setGuardado] = useState(false);
  const { ejecutar, cargando, error } = useAccion(staff.editar);
  const cambiar = (campo: keyof typeof datos) => (e: { target: { value: string } }) => {
    setGuardado(false);
    setDatos({ ...datos, [campo]: e.target.value });
  };

  const comisionPb = datos.comision.trim() === '' ? null : Math.round(Number(datos.comision.replace(',', '.')) * 100);
  const comisionInvalida = comisionPb !== null && (!Number.isFinite(comisionPb) || comisionPb < 0 || comisionPb > 10_000);
  const cambios = {
    ...(datos.nombreVisible.trim() !== inicial.nombreVisible ? { nombreVisible: datos.nombreVisible } : {}),
    ...(datos.perfilId !== inicial.perfilId ? { perfilId: datos.perfilId } : {}),
    ...(datos.comision.trim() !== inicial.comision && !comisionInvalida ? { comisionOperadorPb: comisionPb } : {}),
  };

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const resultado = await ejecutar(persona.id, cambios);
    if (resultado) {
      alGuardar(resultado.valor);
      setGuardado(true);
    }
  }

  const errorGeneral = error && error.errores.length === 0 ? error.message : null;
  return (
    <section className={clases.tarjeta} aria-labelledby="titulo-datos">
      <h2 id="titulo-datos">Datos</h2>
      <form className={clases.formulario} onSubmit={enviar} noValidate>
        {errorGeneral ? <Aviso tipo="error">{errorGeneral}</Aviso> : null}
        {guardado ? <Aviso tipo="ok">Cambios guardados.</Aviso> : null}
        <div className={clases.dosCampos}>
          <CampoFormulario etiqueta="Nombre" value={datos.nombreVisible} onChange={cambiar('nombreVisible')} error={error?.delCampo('nombreVisible')} />
          <SelectorFormulario
            etiqueta="Perfil"
            opciones={lista.map((p) => ({ valor: p.id, texto: p.nombre }))}
            value={datos.perfilId}
            onChange={cambiar('perfilId')}
            disabled={esUnoMismo}
            ayuda={datos.perfilId !== inicial.perfilId && persona.ajustes.length > 0 ? 'Los ajustes individuales se mantienen sobre el perfil nuevo.' : undefined}
          />
          <CampoFormulario
            etiqueta="Comisión propia (%)"
            inputMode="decimal"
            placeholder="La general"
            ayuda="Vacío = usa la comisión general de operadores."
            value={datos.comision}
            onChange={cambiar('comision')}
            disabled={esUnoMismo}
            error={comisionInvalida ? 'Poné un porcentaje entre 0 y 100' : error?.delCampo('comisionOperadorPb')}
          />
        </div>
        <dl className={clases.datos}>
          <dt>Usuario</dt>
          <dd>@{persona.nombreUsuario}</dd>
          <dt>Estado</dt>
          <dd>
            <EstadoStaff persona={persona} />
          </dd>
          <dt>Alta</dt>
          <dd>{formatearFecha(persona.creadoEn)}</dd>
        </dl>
        <div className={clases.filaBotones}>
          <Boton type="submit" cargando={cargando} disabled={Object.keys(cambios).length === 0 || comisionInvalida}>
            Guardar cambios
          </Boton>
        </div>
      </form>
    </section>
  );
}

type Accion = 'contrasena' | '2fa' | 'bloquear' | 'desbloquear';

function Seguridad({ persona, esUnoMismo, alCambiar }: { persona: StaffPanel; esUnoMismo: boolean; alCambiar: (p: StaffPanel) => void }) {
  const [confirmar, setConfirmar] = useState<Accion | null>(null);
  const [temporal, setTemporal] = useState<string | null>(null);
  const nombre = persona.nombreVisible ?? persona.nombreUsuario ?? '';
  const bloqueada = persona.estado === 'bloqueado';
  const { ejecutar, cargando, error } = useAccion(async (accion: Accion) => {
    if (accion === 'contrasena') {
      const { contrasenaTemporal } = await staff.resetearContrasena(persona.id);
      setTemporal(contrasenaTemporal);
      return { ...persona, debeCambiarContrasena: true };
    }
    if (accion === '2fa') {
      await staff.resetear2fa(persona.id);
      return { ...persona, tiene2fa: false };
    }
    return staff.editar(persona.id, { estado: accion === 'bloquear' ? 'bloqueado' : 'activo' });
  });

  async function confirmarAccion(accion: Accion) {
    const resultado = await ejecutar(accion);
    setConfirmar(null);
    if (resultado) alCambiar(resultado.valor);
  }

  const textos: Record<Accion, { titulo: string; boton: string; texto: string; peligro?: boolean }> = {
    contrasena: { titulo: `Resetear la contraseña de ${nombre}`, boton: 'Resetear contraseña', texto: 'Su contraseña deja de funcionar y se cierran sus sesiones. Mantiene su 2FA.' },
    '2fa': { titulo: `Resetear el 2FA de ${nombre}`, boton: 'Resetear 2FA', texto: 'Para cuando pierde el celular. En su próximo ingreso escanea un QR nuevo. Se cierran sus sesiones.' },
    bloquear: { titulo: `Bloquear a ${nombre}`, boton: 'Bloquear', texto: 'No va a poder ingresar al panel. Se cierran sus sesiones.', peligro: true },
    desbloquear: { titulo: `Desbloquear a ${nombre}`, boton: 'Desbloquear', texto: 'Va a poder volver a ingresar al panel.' },
  };

  return (
    <section className={clases.tarjeta} aria-labelledby="titulo-seguridad">
      <h2 id="titulo-seguridad">Acceso</h2>
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      {esUnoMismo ? (
        <p className={clases.explicacion}>Tu contraseña la cambiás desde “Mi cuenta”.</p>
      ) : (
        <>
          <div className={clases.accion}>
            <p>
              <strong>Contraseña</strong>
              Genera una temporal para pasársela.
            </p>
            <Boton variante="secundario" onClick={() => setConfirmar('contrasena')}>
              Resetear
            </Boton>
          </div>
          <div className={clases.accion}>
            <p>
              <strong>Verificación en dos pasos</strong>
              {persona.tiene2fa ? 'Activa.' : 'Todavía no la configuró.'}
            </p>
            <Boton variante="secundario" onClick={() => setConfirmar('2fa')} disabled={!persona.tiene2fa}>
              Resetear 2FA
            </Boton>
          </div>
          <div className={clases.accion}>
            <p>
              <strong>{bloqueada ? 'Bloqueada' : 'Acceso al panel'}</strong>
              {bloqueada ? 'No puede ingresar.' : 'Puede ingresar.'}
            </p>
            <Boton variante={bloqueada ? 'secundario' : 'peligro'} onClick={() => setConfirmar(bloqueada ? 'desbloquear' : 'bloquear')}>
              {bloqueada ? 'Desbloquear' : 'Bloquear'}
            </Boton>
          </div>
        </>
      )}
      {confirmar ? (
        <ModalConfirmacion
          titulo={textos[confirmar].titulo}
          textoConfirmar={textos[confirmar].boton}
          variante={textos[confirmar].peligro ? 'peligro' : 'primario'}
          cargando={cargando}
          alConfirmar={() => void confirmarAccion(confirmar)}
          alCerrar={() => setConfirmar(null)}
        >
          <p>{textos[confirmar].texto}</p>
        </ModalConfirmacion>
      ) : null}
      {temporal ? <ContrasenaTemporal para={nombre} contrasena={temporal} alCerrar={() => setTemporal(null)} /> : null}
    </section>
  );
}

function Permisos({ persona, perfiles: lista, esUnoMismo, alGuardar }: SeccionProps & { perfiles: Perfil[] }) {
  const delPerfil = useMemo(() => new Set<Permiso>(lista.find((p) => p.id === persona.perfil?.id)?.permisos ?? []), [lista, persona.perfil?.id]);
  const [elegidos, setElegidos] = useState<Set<Permiso>>(() => new Set(persona.permisos));
  const [guardado, setGuardado] = useState(false);
  const { ejecutar, cargando, error } = useAccion(staff.ajustes);
  const ajustes = calcularAjustes(elegidos, delPerfil);
  const sinCambios = ajustes.length === persona.ajustes.length && ajustes.every((a) => persona.ajustes.some((b) => b.permiso === a.permiso && b.tipo === a.tipo));

  async function guardar() {
    const resultado = await ejecutar(persona.id, ajustes);
    if (resultado) {
      alGuardar(resultado.valor);
      setGuardado(true);
    }
  }

  return (
    <section className={clases.tarjeta} aria-labelledby="titulo-permisos">
      <div className={clases.barra}>
        <h2 id="titulo-permisos">
          Permisos <span className={clases.total}>({elegidos.size})</span>
        </h2>
        {!esUnoMismo ? (
          <div className={clases.filaBotones}>
            <Boton variante="secundario" onClick={() => setElegidos(new Set(delPerfil))} disabled={ajustes.length === 0}>
              Volver a los del perfil
            </Boton>
            <Boton onClick={() => void guardar()} cargando={cargando} disabled={sinCambios}>
              Guardar permisos
            </Boton>
          </div>
        ) : null}
      </div>
      <p className={clases.explicacion}>
        Parte de los permisos del perfil <strong>{persona.perfil?.nombre ?? '—'}</strong>. Lo que marques o desmarques acá aplica solo a esta persona.
      </p>
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      {guardado && sinCambios ? <Aviso tipo="ok">Permisos guardados. Aplican desde su próxima acción.</Aviso> : null}
      <SelectorPermisos
        valor={elegidos}
        base={delPerfil}
        deshabilitado={esUnoMismo}
        onCambiar={(nuevos) => {
          setGuardado(false);
          setElegidos(nuevos);
        }}
      />
    </section>
  );
}
