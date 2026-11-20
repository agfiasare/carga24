import { Plus, Search } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { jugadores, type JugadorPanel } from '../../api/gestion';
import { useAccion } from '../../api/useAccion';
import { useConsulta } from '../../api/useConsulta';
import { formatearFecha, formatearTelefono } from '../../comun/formato';
import { Aviso, Boton, Campo, CampoFormulario, ContrasenaTemporal, Etiqueta, Modal } from '../../componentes';
import { PaginaPanel, usePermisos } from './PaginaPanel';
import clases from './panel.module.css';

export function EstadoJugador({ jugador }: { jugador: Pick<JugadorPanel, 'estado' | 'debeCambiarContrasena'> }) {
  return (
    <span className={clases.etiquetas}>
      {jugador.estado === 'bloqueado' ? <Etiqueta tono="error">Bloqueado</Etiqueta> : <Etiqueta tono="ok">Activo</Etiqueta>}
      {jugador.debeCambiarContrasena ? <Etiqueta tono="aviso">Contraseña temporal</Etiqueta> : null}
    </span>
  );
}

export function Jugadores() {
  const { tiene } = usePermisos();
  const [texto, setTexto] = useState('');
  const [buscar, setBuscar] = useState('');
  const [pagina, setPagina] = useState(1);
  const [creando, setCreando] = useState(false);
  const { datos, error, cargando } = useConsulta(() => jugadores.listar(buscar, pagina), [buscar, pagina]);

  // Busca 300 ms después de que se deja de escribir.
  useEffect(() => {
    const espera = setTimeout(() => {
      setBuscar(texto.trim());
      setPagina(1);
    }, 300);
    return () => clearTimeout(espera);
  }, [texto]);

  const paginas = datos ? Math.max(1, Math.ceil(datos.total / datos.porPagina)) : 1;

  return (
    <PaginaPanel
      titulo="Jugadores"
      requiere={['jugadores.ver']}
      acciones={
        tiene('jugadores.crear') ? (
          <Boton icono={<Plus size={18} aria-hidden="true" />} onClick={() => setCreando(true)}>
            Nuevo jugador
          </Boton>
        ) : null
      }
    >
      <div className={clases.barra}>
        <Campo
          className={clases.buscador}
          icono={<Search size={18} />}
          placeholder="Buscar por usuario, teléfono o usuario de plataforma"
          aria-label="Buscar jugadores"
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        {datos ? <span className={clases.total}>{datos.total === 1 ? '1 jugador' : `${datos.total} jugadores`}</span> : null}
      </div>
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      <div className={clases.envoltorioTabla} aria-busy={cargando}>
        <table className={clases.tabla}>
          <thead>
            <tr>
              <th scope="col">Jugador</th>
              <th scope="col">Teléfono</th>
              <th scope="col">Usuario en plataforma</th>
              <th scope="col">Estado</th>
              <th scope="col">Alta</th>
            </tr>
          </thead>
          <tbody>
            {datos?.jugadores.map((j) => (
              <tr key={j.id}>
                <td>
                  <Link to={`/panel/jugadores/${j.id}`}>{j.nombreUsuario ?? formatearTelefono(j.telefono)}</Link>
                </td>
                <td>{formatearTelefono(j.telefono)}</td>
                <td>{j.usuarioPlataforma ?? '—'}</td>
                <td>
                  <EstadoJugador jugador={j} />
                </td>
                <td>{formatearFecha(j.creadoEn)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {datos && datos.jugadores.length === 0 ? (
          <p className={clases.vacio}>{buscar ? `No hay jugadores que coincidan con “${buscar}”.` : 'Todavía no hay jugadores.'}</p>
        ) : null}
      </div>
      {paginas > 1 ? (
        <nav className={clases.paginacion} aria-label="Páginas">
          <Boton variante="secundario" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>
            Anterior
          </Boton>
          <span>
            Página {pagina} de {paginas}
          </span>
          <Boton variante="secundario" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>
            Siguiente
          </Boton>
        </nav>
      ) : null}
      {creando ? <NuevoJugador alCerrar={() => setCreando(false)} /> : null}
    </PaginaPanel>
  );
}

function NuevoJugador({ alCerrar }: { alCerrar: () => void }) {
  const [datos, setDatos] = useState({ usuarioPlataforma: '', telefono: '', nombreUsuario: '', notasInternas: '' });
  const [creado, setCreado] = useState<{ jugador: JugadorPanel; contrasenaTemporal: string } | null>(null);
  const { ejecutar, cargando, error } = useAccion(jugadores.crear);
  const navegar = useNavigate();
  const cambiar = (campo: keyof typeof datos) => (e: { target: { value: string } }) => setDatos({ ...datos, [campo]: e.target.value });

  async function enviar(evento?: FormEvent) {
    evento?.preventDefault();
    const resultado = await ejecutar({
      usuarioPlataforma: datos.usuarioPlataforma,
      ...(datos.telefono.trim() ? { telefono: datos.telefono } : {}),
      ...(datos.nombreUsuario.trim() ? { nombreUsuario: datos.nombreUsuario } : {}),
      ...(datos.notasInternas.trim() ? { notasInternas: datos.notasInternas } : {}),
    });
    if (resultado) setCreado(resultado.valor);
  }

  if (creado) {
    return (
      <ContrasenaTemporal
        para={creado.jugador.nombreUsuario ?? formatearTelefono(creado.jugador.telefono)}
        contrasena={creado.contrasenaTemporal}
        alCerrar={() => navegar(`/panel/jugadores/${creado.jugador.id}`)}
      />
    );
  }

  const errorGeneral = error && error.errores.length === 0 ? error.message : null;
  return (
    <Modal
      titulo="Nuevo jugador"
      alCerrar={alCerrar}
      acciones={
        <>
          <Boton variante="secundario" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-nuevo-jugador" cargando={cargando}>
            Crear jugador
          </Boton>
        </>
      }
    >
      <form id="form-nuevo-jugador" className={clases.formulario} onSubmit={enviar} noValidate>
        <p className={clases.explicacion}>Con teléfono o nombre de usuario alcanza. Se genera una contraseña temporal para pasársela.</p>
        {errorGeneral ? <Aviso tipo="error">{errorGeneral}</Aviso> : null}
        <CampoFormulario etiqueta="Usuario en la plataforma" value={datos.usuarioPlataforma} onChange={cambiar('usuarioPlataforma')} error={error?.delCampo('usuarioPlataforma')} />
        <CampoFormulario etiqueta="Teléfono" type="tel" ayuda="Con código de área. Ej.: 11 5555 0001" value={datos.telefono} onChange={cambiar('telefono')} error={error?.delCampo('telefono')} />
        <CampoFormulario etiqueta="Nombre de usuario" ayuda="Opcional si tiene teléfono." value={datos.nombreUsuario} onChange={cambiar('nombreUsuario')} error={error?.delCampo('nombreUsuario')} />
        <label className={clases.campoLibre}>
          <span className={clases.etiquetaCampo}>Notas internas (solo las ve el staff)</span>
          <textarea className={clases.areaTexto} value={datos.notasInternas} onChange={cambiar('notasInternas')} maxLength={1000} />
        </label>
      </form>
    </Modal>
  );
}
