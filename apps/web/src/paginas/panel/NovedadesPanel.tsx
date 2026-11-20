import { Pin, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api } from '../../api/cliente';
import { useAccion } from '../../api/useAccion';
import { useConsulta } from '../../api/useConsulta';
import { formatearFecha } from '../../comun/formato';
import { Aviso, Boton, Casilla, CampoFormulario, Etiqueta, Modal, ModalConfirmacion } from '../../componentes';
import { PaginaPanel } from './PaginaPanel';
import clases from './panel.module.css';

interface NovedadPanel {
  id: string;
  titulo: string;
  texto: string;
  fijada: boolean;
  publicadaEn: string | null;
  creadoEn: string;
}

type Cambios = Partial<{ titulo: string; texto: string; fijada: boolean; publicada: boolean }>;

const novedades = {
  listar: () => api<NovedadPanel[]>('GET', '/novedades'),
  crear: (datos: Cambios) => api<NovedadPanel>('POST', '/novedades', datos),
  editar: (id: string, datos: Cambios) => api<NovedadPanel>('PATCH', `/novedades/${encodeURIComponent(id)}`, datos),
  eliminar: (id: string) => api<void>('DELETE', `/novedades/${encodeURIComponent(id)}`),
};

/** Novedades para los jugadores: borradores, publicadas y una fijada arriba de todo. */
export function NovedadesPanel() {
  const { datos, error, recargar } = useConsulta(novedades.listar, []);
  const [editando, setEditando] = useState<NovedadPanel | 'nueva' | null>(null);
  const [borrando, setBorrando] = useState<NovedadPanel | null>(null);
  const cambio = useAccion(async (id: string, datos: Cambios) => novedades.editar(id, datos));
  const borrado = useAccion(novedades.eliminar);

  async function cambiar(id: string, datos: Cambios) {
    if (await cambio.ejecutar(id, datos)) recargar();
  }

  async function borrar() {
    if (!borrando) return;
    const resultado = await borrado.ejecutar(borrando.id);
    setBorrando(null);
    if (resultado) recargar();
  }

  return (
    <PaginaPanel
      titulo="Novedades"
      requiere={['novedades.publicar']}
      acciones={
        <Boton icono={<Plus size={18} aria-hidden="true" />} onClick={() => setEditando('nueva')}>
          Nueva novedad
        </Boton>
      }
    >
      <p className={clases.total}>Los jugadores ven las publicadas en Novedades. La fijada aparece también en su inicio.</p>
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      {cambio.error ?? borrado.error ? <Aviso tipo="error">{(cambio.error ?? borrado.error)!.message}</Aviso> : null}
      <div className={clases.pila}>
        {datos?.map((n) => (
          <article key={n.id} className={clases.tarjeta} aria-labelledby={`novedad-${n.id}`}>
            <div className={clases.barra}>
              <h2 id={`novedad-${n.id}`}>{n.titulo}</h2>
              <span className={clases.etiquetas}>
                {n.fijada ? (
                  <Etiqueta tono="aviso">
                    <Pin size={12} aria-hidden="true" /> Fijada
                  </Etiqueta>
                ) : null}
                {n.publicadaEn ? <Etiqueta tono="ok">Publicada {formatearFecha(n.publicadaEn)}</Etiqueta> : <Etiqueta>Borrador</Etiqueta>}
              </span>
            </div>
            <p className={clases.explicacion} style={{ whiteSpace: 'pre-line', margin: 0 }}>
              {n.texto}
            </p>
            <div className={clases.filaBotones}>
              <Boton variante="secundario" onClick={() => void cambiar(n.id, { publicada: !n.publicadaEn })}>
                {n.publicadaEn ? 'Despublicar' : 'Publicar'}
              </Boton>
              <Boton variante="secundario" onClick={() => void cambiar(n.id, { fijada: !n.fijada })}>
                {n.fijada ? 'Desfijar' : 'Fijar arriba'}
              </Boton>
              <Boton variante="fantasma" onClick={() => setEditando(n)}>
                Editar
              </Boton>
              <Boton variante="fantasma" onClick={() => setBorrando(n)}>
                Borrar
              </Boton>
            </div>
          </article>
        ))}
        {datos && datos.length === 0 ? <p className={clases.vacio}>Todavía no hay novedades.</p> : null}
      </div>
      {editando ? (
        <EditorNovedad
          novedad={editando === 'nueva' ? null : editando}
          alCerrar={() => setEditando(null)}
          alGuardar={() => {
            setEditando(null);
            recargar();
          }}
        />
      ) : null}
      {borrando ? (
        <ModalConfirmacion titulo={`Borrar "${borrando.titulo}"`} textoConfirmar="Borrar" variante="peligro" cargando={borrado.cargando} alConfirmar={() => void borrar()} alCerrar={() => setBorrando(null)}>
          <p>Deja de verse para los jugadores. No se puede deshacer.</p>
        </ModalConfirmacion>
      ) : null}
    </PaginaPanel>
  );
}

function EditorNovedad({ novedad, alCerrar, alGuardar }: { novedad: NovedadPanel | null; alCerrar: () => void; alGuardar: () => void }) {
  const [titulo, setTitulo] = useState(novedad?.titulo ?? '');
  const [texto, setTexto] = useState(novedad?.texto ?? '');
  const [publicada, setPublicada] = useState(Boolean(novedad?.publicadaEn));
  const [fijada, setFijada] = useState(novedad?.fijada ?? false);
  const guardado = useAccion((datos: Cambios) => (novedad ? novedades.editar(novedad.id, datos) : novedades.crear(datos)));

  async function enviar(evento?: FormEvent) {
    evento?.preventDefault();
    if (await guardado.ejecutar({ titulo, texto, publicada, fijada })) alGuardar();
  }

  const error = guardado.error;
  return (
    <Modal
      titulo={novedad ? 'Editar novedad' : 'Nueva novedad'}
      alCerrar={alCerrar}
      acciones={
        <>
          <Boton variante="secundario" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-novedad" cargando={guardado.cargando} disabled={!titulo.trim() || !texto.trim()}>
            Guardar
          </Boton>
        </>
      }
    >
      <form id="form-novedad" className={clases.formulario} onSubmit={enviar} noValidate>
        {error && error.errores.length === 0 ? <Aviso tipo="error">{error.message}</Aviso> : null}
        <CampoFormulario etiqueta="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={80} error={error?.delCampo('titulo')} />
        <label className={clases.campoLibre}>
          <span className={clases.etiquetaCampo}>Texto</span>
          <textarea className={clases.areaTexto} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000} rows={6} />
        </label>
        <Casilla etiqueta="Publicada" detalle="Los jugadores la ven en Novedades." checked={publicada} onChange={(e) => setPublicada(e.target.checked)} />
        <Casilla etiqueta="Fijada arriba" detalle="Aparece también en el inicio del jugador. Solo puede haber una." checked={fijada} onChange={(e) => setFijada(e.target.checked)} />
      </form>
    </Modal>
  );
}
