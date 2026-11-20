import type { Permiso } from '@carga24/shared';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { perfiles, type Perfil } from '../../api/gestion';
import { useAccion } from '../../api/useAccion';
import { useConsulta } from '../../api/useConsulta';
import { Aviso, Boton, CampoFormulario, ModalConfirmacion, SelectorPermisos } from '../../componentes';
import { useSesionStaff } from '../../sesion/sesion';
import { PaginaPanel } from './PaginaPanel';
import clases from './panel.module.css';

/** Crear (/panel/perfiles/nuevo) o editar (/panel/perfiles/:id) un perfil. */
export function PerfilEditor() {
  const { id } = useParams();
  const { datos: lista, error } = useConsulta(perfiles.listar, []);
  const perfil = id ? lista?.find((p) => p.id === id) : undefined;
  const titulo = id ? (perfil?.nombre ?? 'Perfil') : 'Nuevo perfil';

  return (
    <PaginaPanel titulo={titulo} requiere={['perfiles.gestionar']} volver={<Link to="/panel/perfiles">← Perfiles</Link>}>
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      {lista && id && !perfil ? <Aviso tipo="error">No encontramos ese perfil.</Aviso> : null}
      {lista && (!id || perfil) ? <Formulario key={perfil?.id ?? 'nuevo'} perfil={perfil} /> : null}
    </PaginaPanel>
  );
}

function Formulario({ perfil }: { perfil?: Perfil }) {
  const { usuario } = useSesionStaff();
  const navegar = useNavigate();
  const esElPropio = Boolean(perfil && perfil.id === usuario?.perfil?.id);
  const [nombre, setNombre] = useState(perfil?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(perfil?.descripcion ?? '');
  const [permisos, setPermisos] = useState<Set<Permiso>>(() => new Set(perfil?.permisos ?? []));
  const [borrando, setBorrando] = useState(false);
  const guardado = useAccion((datos: { nombre: string; descripcion: string | null; permisos: Permiso[] }) =>
    perfil ? perfiles.editar(perfil.id, datos) : perfiles.crear(datos),
  );
  const borrado = useAccion(() => perfiles.eliminar(perfil?.id ?? ''));

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const resultado = await guardado.ejecutar({ nombre, descripcion: descripcion.trim() || null, permisos: [...permisos] });
    if (resultado) navegar('/panel/perfiles');
  }

  async function borrar() {
    const resultado = await borrado.ejecutar();
    setBorrando(false);
    if (resultado) navegar('/panel/perfiles');
  }

  const error = guardado.error ?? borrado.error;
  return (
    <form className={clases.pila} onSubmit={enviar} noValidate>
      {esElPropio ? <Aviso tipo="info">Es el perfil que tenés asignado: no lo podés editar porque cambiarías tus propios permisos.</Aviso> : null}
      {perfil && perfil.cantidadUsuarios > 0 ? (
        <Aviso tipo="info">
          Lo usan {perfil.cantidadUsuarios === 1 ? '1 persona' : `${perfil.cantidadUsuarios} personas`}: los cambios les aplican a todas.
        </Aviso>
      ) : null}
      {error && error.errores.length === 0 ? <Aviso tipo="error">{error.message}</Aviso> : null}
      <section className={clases.tarjeta} aria-labelledby="titulo-perfil">
        <h2 id="titulo-perfil">Nombre</h2>
        <div className={clases.dosCampos}>
          <CampoFormulario etiqueta="Nombre del perfil" value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={esElPropio} error={guardado.error?.delCampo('nombre')} />
          <CampoFormulario etiqueta="Descripción (opcional)" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} disabled={esElPropio} />
        </div>
      </section>
      <section className={clases.tarjeta} aria-labelledby="titulo-permisos-perfil">
        <h2 id="titulo-permisos-perfil">
          Permisos <span className={clases.total}>({permisos.size})</span>
        </h2>
        <SelectorPermisos valor={permisos} onCambiar={setPermisos} deshabilitado={esElPropio} />
      </section>
      {!esElPropio ? (
        <div className={clases.barra}>
          <Boton type="submit" tamano="lg" cargando={guardado.cargando} disabled={!nombre.trim()}>
            {perfil ? 'Guardar perfil' : 'Crear perfil'}
          </Boton>
          {perfil ? (
            <Boton variante="peligro" onClick={() => setBorrando(true)} disabled={perfil.cantidadUsuarios > 0} title={perfil.cantidadUsuarios > 0 ? 'Primero cambiá el perfil de las personas que lo usan' : undefined}>
              Borrar perfil
            </Boton>
          ) : null}
        </div>
      ) : null}
      {borrando && perfil ? (
        <ModalConfirmacion titulo={`Borrar el perfil ${perfil.nombre}`} textoConfirmar="Borrar" variante="peligro" cargando={borrado.cargando} alConfirmar={() => void borrar()} alCerrar={() => setBorrando(false)}>
          <p>No lo usa nadie. Esta acción no se puede deshacer.</p>
        </ModalConfirmacion>
      ) : null}
    </form>
  );
}
