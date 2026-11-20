import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { perfiles, staff, type StaffPanel } from '../../api/gestion';
import { useAccion } from '../../api/useAccion';
import { useConsulta } from '../../api/useConsulta';
import { Aviso, Boton, CampoFormulario, ContrasenaTemporal, Etiqueta, Modal, SelectorFormulario } from '../../componentes';
import { useSesionStaff } from '../../sesion/sesion';
import { PaginaPanel } from './PaginaPanel';
import clases from './panel.module.css';

export function EstadoStaff({ persona }: { persona: Pick<StaffPanel, 'estado' | 'tiene2fa' | 'debeCambiarContrasena' | 'ajustes'> }) {
  return (
    <span className={clases.etiquetas}>
      {persona.estado === 'bloqueado' ? <Etiqueta tono="error">Bloqueado</Etiqueta> : <Etiqueta tono="ok">Activo</Etiqueta>}
      {persona.debeCambiarContrasena ? <Etiqueta tono="aviso">Contraseña temporal</Etiqueta> : null}
      {!persona.tiene2fa ? <Etiqueta tono="aviso">Sin 2FA</Etiqueta> : null}
      {persona.ajustes.length > 0 ? <Etiqueta>Permisos ajustados</Etiqueta> : null}
    </span>
  );
}

export function Staff() {
  const { usuario } = useSesionStaff();
  const [creando, setCreando] = useState(false);
  const { datos, error } = useConsulta(staff.listar, []);

  return (
    <PaginaPanel
      titulo="Staff"
      requiere={['staff.gestionar']}
      acciones={
        <Boton icono={<Plus size={18} aria-hidden="true" />} onClick={() => setCreando(true)}>
          Nueva persona
        </Boton>
      }
    >
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      <div className={clases.envoltorioTabla}>
        <table className={clases.tabla}>
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Perfil</th>
              <th scope="col">Permisos</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            {datos?.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link to={`/panel/staff/${s.id}`}>{s.nombreVisible ?? s.nombreUsuario}</Link>
                  <span className={clases.secundario}>
                    @{s.nombreUsuario}
                    {s.id === usuario?.id ? ' · vos' : ''}
                  </span>
                </td>
                <td>{s.perfil?.nombre ?? '—'}</td>
                <td>{s.permisos.length}</td>
                <td>
                  <EstadoStaff persona={s} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {creando ? <NuevaPersona alCerrar={() => setCreando(false)} /> : null}
    </PaginaPanel>
  );
}

function NuevaPersona({ alCerrar }: { alCerrar: () => void }) {
  const { datos: listaPerfiles } = useConsulta(perfiles.listar, []);
  const [datos, setDatos] = useState({ nombreVisible: '', nombreUsuario: '', perfilId: '' });
  const [creada, setCreada] = useState<{ staff: StaffPanel; contrasenaTemporal: string } | null>(null);
  const { ejecutar, cargando, error } = useAccion(staff.crear);
  const navegar = useNavigate();
  const cambiar = (campo: keyof typeof datos) => (e: { target: { value: string } }) => setDatos({ ...datos, [campo]: e.target.value });

  async function enviar(evento?: FormEvent) {
    evento?.preventDefault();
    const resultado = await ejecutar(datos);
    if (resultado) setCreada(resultado.valor);
  }

  if (creada) {
    return (
      <ContrasenaTemporal
        para={creada.staff.nombreVisible ?? creada.staff.nombreUsuario ?? ''}
        contrasena={creada.contrasenaTemporal}
        alCerrar={() => navegar(`/panel/staff/${creada.staff.id}`)}
      />
    );
  }

  const errorGeneral = error && error.errores.length === 0 ? error.message : null;
  return (
    <Modal
      titulo="Nueva persona del staff"
      alCerrar={alCerrar}
      acciones={
        <>
          <Boton variante="secundario" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-nuevo-staff" cargando={cargando}>
            Crear
          </Boton>
        </>
      }
    >
      <form id="form-nuevo-staff" className={clases.formulario} onSubmit={enviar} noValidate>
        <p className={clases.explicacion}>En su primer ingreso elige su contraseña y activa la verificación en dos pasos. Los permisos individuales se ajustan después.</p>
        {errorGeneral ? <Aviso tipo="error">{errorGeneral}</Aviso> : null}
        <CampoFormulario etiqueta="Nombre" ayuda="Como se muestra en el panel." value={datos.nombreVisible} onChange={cambiar('nombreVisible')} error={error?.delCampo('nombreVisible')} />
        <CampoFormulario etiqueta="Usuario para ingresar" value={datos.nombreUsuario} onChange={cambiar('nombreUsuario')} error={error?.delCampo('nombreUsuario')} autoComplete="off" />
        <SelectorFormulario
          etiqueta="Perfil"
          vacio="Elegí un perfil"
          opciones={(listaPerfiles ?? []).map((p) => ({ valor: p.id, texto: `${p.nombre} (${p.permisos.length} permisos)` }))}
          value={datos.perfilId}
          onChange={cambiar('perfilId')}
          error={error?.delCampo('perfilId')}
        />
      </form>
    </Modal>
  );
}
