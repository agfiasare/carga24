import { formatearPesos } from '@carga24/shared';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { jugadores, type JugadorPanel } from '../../api/gestion';
import { useAccion } from '../../api/useAccion';
import { useConsulta } from '../../api/useConsulta';
import { formatearFecha, formatearTelefono } from '../../comun/formato';
import { Aviso, Boton, CampoFormulario, ContrasenaTemporal, ModalConfirmacion } from '../../componentes';
import { EstadoJugador } from './Jugadores';
import { ListaPedidos } from './ListaPedidos';
import { PaginaPanel, usePermisos } from './PaginaPanel';
import clases from './panel.module.css';
import propias from './reportes.module.css';

export function JugadorDetalle() {
  const { id = '' } = useParams();
  const { tiene } = usePermisos();
  const { datos: jugador, setDatos, error } = useConsulta(() => jugadores.obtener(id), [id]);
  const nombre = jugador ? (jugador.nombreUsuario ?? formatearTelefono(jugador.telefono)) : 'Jugador';

  return (
    <PaginaPanel titulo={nombre} requiere={['jugadores.ver']} volver={<Link to="/panel/jugadores">← Jugadores</Link>}>
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      {jugador ? (
        <div className={clases.columnas}>
          <DatosJugador key={jugador.id} jugador={jugador} alGuardar={setDatos} />
          <div className={clases.pila}>
            <Acciones jugador={jugador} alCambiar={setDatos} />
          </div>
        </div>
      ) : null}
      {jugador && tiene('pedidos.ver') ? <PedidosDelJugador id={jugador.id} /> : null}
    </PaginaPanel>
  );
}

function DatosJugador({ jugador, alGuardar }: { jugador: JugadorPanel; alGuardar: (j: JugadorPanel) => void }) {
  const { tiene } = usePermisos();
  const editable = tiene('jugadores.editar');
  const inicial = {
    usuarioPlataforma: jugador.usuarioPlataforma ?? '',
    telefono: jugador.telefono ?? '',
    nombreUsuario: jugador.nombreUsuario ?? '',
    notasInternas: jugador.notasInternas ?? '',
  };
  const [datos, setDatosForm] = useState(inicial);
  const [guardado, setGuardado] = useState(false);
  const { ejecutar, cargando, error } = useAccion(jugadores.editar);
  const cambiar = (campo: keyof typeof datos) => (e: { target: { value: string } }) => {
    setGuardado(false);
    setDatosForm({ ...datos, [campo]: e.target.value });
  };

  // Solo se envía lo que cambió; un campo vacío borra el dato.
  const cambios = Object.fromEntries(
    (Object.keys(datos) as (keyof typeof datos)[])
      .filter((c) => datos[c].trim() !== inicial[c])
      .map((c) => [c, c === 'usuarioPlataforma' ? datos[c] : datos[c].trim() || null]),
  );

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const resultado = await ejecutar(jugador.id, cambios);
    if (resultado) {
      alGuardar({ ...resultado.valor, notasInternas: resultado.valor.notasInternas ?? null });
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
          <CampoFormulario etiqueta="Usuario en la plataforma" value={datos.usuarioPlataforma} onChange={cambiar('usuarioPlataforma')} disabled={!editable} error={error?.delCampo('usuarioPlataforma')} />
          <CampoFormulario etiqueta="Teléfono" type="tel" value={datos.telefono} onChange={cambiar('telefono')} disabled={!editable} error={error?.delCampo('telefono')} ayuda={jugador.telefono ? formatearTelefono(jugador.telefono) : undefined} />
          <CampoFormulario etiqueta="Nombre de usuario" value={datos.nombreUsuario} onChange={cambiar('nombreUsuario')} disabled={!editable} error={error?.delCampo('nombreUsuario')} />
        </div>
        <label className={clases.campoLibre}>
          <span className={clases.etiquetaCampo}>Notas internas (solo las ve el staff)</span>
          <textarea className={clases.areaTexto} value={datos.notasInternas} onChange={cambiar('notasInternas')} disabled={!editable} maxLength={1000} />
        </label>
        <dl className={clases.datos}>
          <dt>Estado</dt>
          <dd>
            <EstadoJugador jugador={jugador} />
          </dd>
          <dt>Alta</dt>
          <dd>{formatearFecha(jugador.creadoEn)}</dd>
        </dl>
        {editable ? (
          <div className={clases.acciones}>
            <Boton type="submit" cargando={cargando} disabled={Object.keys(cambios).length === 0}>
              Guardar cambios
            </Boton>
          </div>
        ) : null}
      </form>
    </section>
  );
}

function Acciones({ jugador, alCambiar }: { jugador: JugadorPanel; alCambiar: (j: JugadorPanel) => void }) {
  const { tiene } = usePermisos();
  const [confirmar, setConfirmar] = useState<'bloquear' | 'desbloquear' | 'resetear' | null>(null);
  const [temporal, setTemporal] = useState<string | null>(null);
  const nombre = jugador.nombreUsuario ?? formatearTelefono(jugador.telefono);
  const estado = useAccion((accion: 'bloquear' | 'desbloquear') => jugadores[accion](jugador.id));
  const reseteo = useAccion(() => jugadores.resetearContrasena(jugador.id));
  const bloqueado = jugador.estado === 'bloqueado';

  if (!tiene('jugadores.bloquear') && !tiene('jugadores.resetear_contrasena')) return null;

  async function cambiarEstado(accion: 'bloquear' | 'desbloquear') {
    const resultado = await estado.ejecutar(accion);
    if (resultado) alCambiar({ ...jugador, ...resultado.valor });
    setConfirmar(null);
  }

  async function resetear() {
    const resultado = await reseteo.ejecutar();
    setConfirmar(null);
    if (resultado) {
      setTemporal(resultado.valor.contrasenaTemporal);
      alCambiar({ ...jugador, debeCambiarContrasena: true });
    }
  }

  const error = estado.error ?? reseteo.error;
  return (
    <section className={clases.tarjeta} aria-labelledby="titulo-acciones">
      <h2 id="titulo-acciones">Acciones</h2>
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      {tiene('jugadores.resetear_contrasena') ? (
        <div className={clases.accion}>
          <p>
            <strong>Resetear contraseña</strong>
            Se genera una temporal y se cierran sus sesiones.
          </p>
          <Boton variante="secundario" onClick={() => setConfirmar('resetear')}>
            Resetear
          </Boton>
        </div>
      ) : null}
      {tiene('jugadores.bloquear') ? (
        <div className={clases.accion}>
          <p>
            <strong>{bloqueado ? 'Desbloquear' : 'Bloquear'}</strong>
            {bloqueado ? 'Vuelve a poder ingresar y hacer pedidos.' : 'No puede ingresar ni hacer pedidos.'}
          </p>
          <Boton variante={bloqueado ? 'secundario' : 'peligro'} onClick={() => setConfirmar(bloqueado ? 'desbloquear' : 'bloquear')}>
            {bloqueado ? 'Desbloquear' : 'Bloquear'}
          </Boton>
        </div>
      ) : null}

      {confirmar === 'resetear' ? (
        <ModalConfirmacion titulo={`Resetear la contraseña de ${nombre}`} textoConfirmar="Resetear contraseña" cargando={reseteo.cargando} alConfirmar={() => void resetear()} alCerrar={() => setConfirmar(null)}>
          <p>Su contraseña actual deja de funcionar y se cierran sus sesiones. Te mostramos una temporal para que se la pases.</p>
        </ModalConfirmacion>
      ) : null}
      {confirmar === 'bloquear' || confirmar === 'desbloquear' ? (
        <ModalConfirmacion
          titulo={`${confirmar === 'bloquear' ? 'Bloquear' : 'Desbloquear'} a ${nombre}`}
          textoConfirmar={confirmar === 'bloquear' ? 'Bloquear' : 'Desbloquear'}
          variante={confirmar === 'bloquear' ? 'peligro' : 'primario'}
          cargando={estado.cargando}
          alConfirmar={() => void cambiarEstado(confirmar)}
          alCerrar={() => setConfirmar(null)}
        >
          <p>{confirmar === 'bloquear' ? 'No va a poder ingresar ni hacer pedidos hasta que lo desbloquees. Se cierran sus sesiones.' : 'Va a poder volver a ingresar con su contraseña.'}</p>
        </ModalConfirmacion>
      ) : null}
      {temporal ? <ContrasenaTemporal para={nombre} contrasena={temporal} alCerrar={() => setTemporal(null)} /> : null}
    </section>
  );
}

const FILTROS = [
  { clave: 'todos', texto: 'Todos' },
  { clave: 'carga', texto: 'Cargas' },
  { clave: 'retiro', texto: 'Retiros' },
  { clave: 'rechazado', texto: 'Rechazados' },
  { clave: 'en_curso', texto: 'En curso' },
] as const;
type Filtro = (typeof FILTROS)[number]['clave'];

/** Cargas y retiros del jugador, con totales; incluye los rechazados y los que siguen en curso. */
function PedidosDelJugador({ id }: { id: string }) {
  const { datos, error } = useConsulta(() => jugadores.pedidos(id), [id]);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const visibles = (datos?.pedidos ?? []).filter((p) => {
    if (filtro === 'todos') return true;
    if (filtro === 'rechazado') return p.estado === 'rechazado';
    if (filtro === 'en_curso') return !['acreditado', 'pagado', 'rechazado'].includes(p.estado);
    return p.tipo === filtro;
  });
  const t = datos?.totales;
  return (
    <section className={clases.tarjeta} aria-labelledby="titulo-pedidos-jugador">
      <h2 id="titulo-pedidos-jugador">Pedidos</h2>
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      {t ? (
        <div className={propias.indicadores}>
          <div className={propias.indicador}>
            <span className={propias.indicadorTitulo}>Cargado</span>
            <span className={propias.indicadorValor}>{formatearPesos(t.cargas.monto)}</span>
            <span className={propias.indicadorDetalle}>{t.cargas.cantidad} {t.cargas.cantidad === 1 ? 'carga acreditada' : 'cargas acreditadas'}</span>
          </div>
          <div className={propias.indicador}>
            <span className={propias.indicadorTitulo}>Retirado</span>
            <span className={propias.indicadorValor}>{formatearPesos(t.retiros.monto)}</span>
            <span className={propias.indicadorDetalle}>{t.retiros.cantidad} {t.retiros.cantidad === 1 ? 'retiro pagado' : 'retiros pagados'}</span>
          </div>
          <div className={propias.indicador}>
            <span className={propias.indicadorTitulo}>Ganancia</span>
            <span className={propias.indicadorValor}>{formatearPesos(t.ganancia)}</span>
          </div>
          <div className={propias.indicador}>
            <span className={propias.indicadorTitulo}>Rechazados / en curso</span>
            <span className={propias.indicadorValor}>
              {t.rechazados} / {t.enCurso}
            </span>
            <span className={propias.indicadorDetalle}>de {t.pedidos} pedidos</span>
          </div>
        </div>
      ) : null}
      <div className={propias.periodo} role="group" aria-label="Mostrar">
        {FILTROS.map((f) => (
          <button key={f.clave} type="button" className={filtro === f.clave ? propias.chipActivo : propias.chip} aria-pressed={filtro === f.clave} onClick={() => setFiltro(f.clave)}>
            {f.texto}
          </button>
        ))}
      </div>
      {datos ? <ListaPedidos pedidos={visibles} vacio="No hay pedidos con ese filtro." /> : null}
      {datos && datos.pedidos.length === 200 ? <p className={clases.explicacion}>Se muestran los últimos 200. Los anteriores se buscan en Reportes.</p> : null}
    </section>
  );
}
