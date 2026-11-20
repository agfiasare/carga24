import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { fechaRelativa } from '../../api/administracion';
import { fechaDe, promociones, textoVigencia, type DatosPromo, type PromoPanel } from '../../api/promociones';
import { useAccion } from '../../api/useAccion';
import { useConsulta } from '../../api/useConsulta';
import { formatearFecha } from '../../comun/formato';
import { Aviso, Boton, Campo, CampoFormulario, Casilla, CuponPromo, Etiqueta, Modal, ModalConfirmacion } from '../../componentes';
import { PaginaPanel } from './PaginaPanel';
import clases from './panel.module.css';

const SITUACION: Record<PromoPanel['situacion'], { texto: string; tono: 'ok' | 'aviso' | 'error' | 'neutro' }> = {
  vigente: { texto: 'Vigente', tono: 'ok' },
  programada: { texto: 'Programada', tono: 'aviso' },
  pausada: { texto: 'Pausada', tono: 'neutro' },
  vencida: { texto: 'Vencida', tono: 'error' },
};

/** Promociones con código: el jugador lo pone al cargar y el operador aplica el bono al acreditar. */
export function Promociones() {
  const { datos, error, recargar } = useConsulta(promociones.listar, []);
  const [editando, setEditando] = useState<PromoPanel | 'nueva' | null>(null);
  const [borrando, setBorrando] = useState<PromoPanel | null>(null);
  const cambio = useAccion(promociones.editar);
  const borrado = useAccion(promociones.eliminar);

  async function pausar(p: PromoPanel) {
    if (await cambio.ejecutar(p.id, { activa: !p.activa })) recargar();
  }

  async function borrar() {
    if (!borrando) return;
    const r = await borrado.ejecutar(borrando.id);
    setBorrando(null);
    if (r) recargar();
  }

  const fallo = error ?? cambio.error ?? borrado.error;
  return (
    <PaginaPanel
      titulo="Promociones"
      requiere={['promos.gestionar']}
      acciones={
        <Boton icono={<Plus size={18} aria-hidden="true" />} onClick={() => setEditando('nueva')}>
          Nueva promoción
        </Boton>
      }
    >
      <p className={clases.total}>El jugador pone el código al pedir la carga (o lo carga el operador). El bono lo aplica quien acredita, según las condiciones.</p>
      {fallo ? <Aviso tipo="error">{fallo.message}</Aviso> : null}
      <div className={clases.envoltorioTabla}>
        <table className={clases.tabla}>
          <thead>
            <tr>
              <th scope="col">Promoción</th>
              <th scope="col">Código</th>
              <th scope="col">Vigencia</th>
              <th scope="col">Dónde se ve</th>
              <th scope="col">Usos</th>
              <th scope="col">Estado</th>
              <th scope="col">
                <span className="visualmente-oculto">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {datos?.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.titulo}</strong>
                  <span className={clases.secundario}>{p.condiciones.length > 60 ? `${p.condiciones.slice(0, 60)}…` : p.condiciones}</span>
                </td>
                <td>
                  <code>{p.codigo}</code>
                </td>
                <td>
                  {formatearFecha(p.desde)} – {formatearFecha(p.hasta)}
                </td>
                <td>{[p.enLanding && 'Landing', p.enInicio && 'Inicio', p.enNovedades && 'Novedades'].filter(Boolean).join(', ') || '—'}</td>
                <td>{p.usos}</td>
                <td>
                  <Etiqueta tono={SITUACION[p.situacion].tono}>{SITUACION[p.situacion].texto}</Etiqueta>
                </td>
                <td>
                  <span className={clases.filaBotones}>
                    <Boton variante="fantasma" onClick={() => setEditando(p)}>
                      Editar
                    </Boton>
                    <Boton variante="fantasma" onClick={() => void pausar(p)}>
                      {p.activa ? 'Pausar' : 'Reactivar'}
                    </Boton>
                    {p.usos === 0 ? (
                      <Boton variante="fantasma" onClick={() => setBorrando(p)}>
                        Borrar
                      </Boton>
                    ) : null}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {datos && datos.length === 0 ? <p className={clases.vacio}>Todavía no hay promociones.</p> : null}
      </div>
      {editando ? (
        <EditorPromo
          promo={editando === 'nueva' ? null : editando}
          alCerrar={() => setEditando(null)}
          alGuardar={() => {
            setEditando(null);
            recargar();
          }}
        />
      ) : null}
      {borrando ? (
        <ModalConfirmacion titulo={`Borrar ${borrando.codigo}`} textoConfirmar="Borrar" variante="peligro" cargando={borrado.cargando} alConfirmar={() => void borrar()} alCerrar={() => setBorrando(null)}>
          <p>Nunca se usó. Se borra del todo.</p>
        </ModalConfirmacion>
      ) : null}
    </PaginaPanel>
  );
}

function EditorPromo({ promo, alCerrar, alGuardar }: { promo: PromoPanel | null; alCerrar: () => void; alGuardar: () => void }) {
  const [datos, setDatos] = useState<DatosPromo>(
    promo
      ? { titulo: promo.titulo, condiciones: promo.condiciones, codigo: promo.codigo, desde: fechaDe(promo.desde), hasta: fechaDe(promo.hasta), activa: promo.activa, enLanding: promo.enLanding, enInicio: promo.enInicio, enNovedades: promo.enNovedades }
      : { titulo: '', condiciones: '', codigo: '', desde: fechaRelativa(), hasta: fechaRelativa(7), activa: true, enLanding: true, enInicio: true, enNovedades: false },
  );
  const guardado = useAccion((d: DatosPromo) => (promo ? promociones.editar(promo.id, d) : promociones.crear(d)));
  const cambiar = (campo: keyof DatosPromo) => (e: { target: { value: string } }) => setDatos({ ...datos, [campo]: e.target.value });
  const marcar = (campo: keyof DatosPromo) => (e: { target: { checked: boolean } }) => setDatos({ ...datos, [campo]: e.target.checked });

  async function enviar(evento?: FormEvent) {
    evento?.preventDefault();
    if (await guardado.ejecutar({ ...datos, codigo: datos.codigo.trim().toUpperCase() })) alGuardar();
  }

  const error = guardado.error;
  const listo = datos.titulo.trim() && datos.condiciones.trim() && datos.codigo.trim() && datos.desde && datos.hasta && datos.desde <= datos.hasta;
  return (
    <Modal
      titulo={promo ? `Editar ${promo.codigo}` : 'Nueva promoción'}
      alCerrar={alCerrar}
      acciones={
        <>
          <Boton variante="secundario" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-promo" cargando={guardado.cargando} disabled={!listo}>
            Guardar
          </Boton>
        </>
      }
    >
      <form id="form-promo" className={clases.formulario} onSubmit={enviar} noValidate>
        {error && error.errores.length === 0 ? <Aviso tipo="error">{error.message}</Aviso> : null}
        <div aria-label="Vista previa del cupón" role="group">
          <CuponPromo titulo={datos.titulo || 'Título de la promo'} condiciones={datos.condiciones || 'Las condiciones aparecen acá.'} codigo={datos.codigo.toUpperCase() || 'CODIGO'} vigencia={datos.hasta ? textoVigencia(`${datos.hasta}T12:00:00-03:00`) : undefined} />
        </div>
        <CampoFormulario etiqueta="Título" value={datos.titulo} onChange={cambiar('titulo')} maxLength={60} error={error?.delCampo('titulo')} />
        <label className={clases.campoLibre}>
          <span className={clases.etiquetaCampo}>Condiciones</span>
          <textarea className={clases.areaTexto} value={datos.condiciones} onChange={cambiar('condiciones')} maxLength={300} rows={3} />
        </label>
        <CampoFormulario etiqueta="Código" ayuda="De 4 a 20 letras o números." value={datos.codigo} onChange={cambiar('codigo')} autoCapitalize="characters" error={error?.delCampo('codigo')} />
        <div className={clases.dosCampos}>
          <label className={clases.campoLibre}>
            <span className={clases.etiquetaCampo}>Desde</span>
            <Campo type="date" value={datos.desde} onChange={cambiar('desde')} />
          </label>
          <label className={clases.campoLibre}>
            <span className={clases.etiquetaCampo}>Hasta</span>
            <Campo type="date" value={datos.hasta} min={datos.desde} onChange={cambiar('hasta')} />
          </label>
        </div>
        <fieldset className={clases.campoLibre} style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className={clases.etiquetaCampo}>Dónde se muestra</legend>
          <Casilla etiqueta="Landing" detalle="El cupón de la página principal, sin iniciar sesión." checked={datos.enLanding} onChange={marcar('enLanding')} />
          <Casilla etiqueta="Inicio del jugador" checked={datos.enInicio} onChange={marcar('enInicio')} />
          <Casilla etiqueta="Novedades" checked={datos.enNovedades} onChange={marcar('enNovedades')} />
        </fieldset>
        <Casilla etiqueta="Activa" detalle="Si la pausás, el código deja de valer." checked={datos.activa} onChange={marcar('activa')} />
      </form>
    </Modal>
  );
}
