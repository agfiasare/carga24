import { useState } from 'react';
import { administracion } from '../../api/administracion';
import { useConsulta } from '../../api/useConsulta';
import { formatearFecha, formatearHora } from '../../comun/formato';
import { Aviso, Boton, Campo, Etiqueta, Selector } from '../../componentes';
import { PaginaPanel } from './PaginaPanel';
import clases from './panel.module.css';
import propias from './reportes.module.css';

/** Registro de todo lo que pasó. Solo lectura: nadie puede editarlo ni borrarlo. */
export function Auditoria() {
  const { datos: opciones } = useConsulta(administracion.opcionesAuditoria, []);
  const [filtros, setFiltros] = useState({ actorId: '', accion: '', desde: '', hasta: '', pagina: 1 });
  const { datos, error, cargando } = useConsulta(() => administracion.auditoria(filtros), [filtros]);
  const cambiar = (campo: keyof typeof filtros) => (e: { target: { value: string } }) => setFiltros({ ...filtros, [campo]: e.target.value, pagina: 1 });
  const paginas = datos ? Math.max(1, Math.ceil(datos.total / datos.porPagina)) : 1;

  return (
    <PaginaPanel titulo="Auditoría" requiere={['auditoria.ver']}>
      <p className={clases.total}>Cada acción del staff y cada ingreso quedan registrados. Los registros no se pueden editar ni borrar.</p>
      <div className={propias.filtros}>
        <Selector aria-label="Persona" vacio="Todas las personas" opciones={(opciones?.personas ?? []).map((p) => ({ valor: p.id, texto: p.nombre }))} value={filtros.actorId} onChange={cambiar('actorId')} />
        <Selector aria-label="Acción" vacio="Todas las acciones" opciones={(opciones?.acciones ?? []).map((a) => ({ valor: a, texto: a }))} value={filtros.accion} onChange={cambiar('accion')} />
        <Campo type="date" aria-label="Desde" value={filtros.desde} onChange={cambiar('desde')} />
        <Campo type="date" aria-label="Hasta" value={filtros.hasta} onChange={cambiar('hasta')} />
      </div>
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      <div className={clases.envoltorioTabla} aria-busy={cargando}>
        <table className={clases.tabla}>
          <thead>
            <tr>
              <th scope="col">Cuándo</th>
              <th scope="col">Quién</th>
              <th scope="col">Acción</th>
              <th scope="col">Sobre</th>
              <th scope="col">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {datos?.registros.map((r) => (
              <tr key={r.id}>
                <td>
                  {formatearFecha(r.creadoEn)} {formatearHora(r.creadoEn)}
                </td>
                <td>
                  {r.actor ? (
                    <>
                      {r.actor.nombre} {r.actor.tipo === 'jugador' ? <Etiqueta>jugador</Etiqueta> : null}
                    </>
                  ) : (
                    '—'
                  )}
                  {r.ip ? <span className={clases.secundario}>{r.ip}</span> : null}
                </td>
                <td>
                  <code>{r.accion}</code>
                </td>
                <td>
                  {r.entidad}
                  {r.entidadId ? <span className={clases.secundario}>{r.entidad === 'pedido' ? `#${r.entidadId}` : r.entidadId.slice(0, 8)}</span> : null}
                </td>
                <td style={{ whiteSpace: 'normal', maxWidth: 360 }}>
                  {r.datos ? (
                    <details>
                      <summary>Ver datos</summary>
                      <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>{JSON.stringify(r.datos, null, 2)}</pre>
                    </details>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {datos && datos.total === 0 ? <p className={clases.vacio}>No hay registros con esos filtros.</p> : null}
      </div>
      {paginas > 1 ? (
        <nav className={clases.paginacion} aria-label="Páginas">
          <Boton variante="secundario" disabled={filtros.pagina <= 1} onClick={() => setFiltros({ ...filtros, pagina: filtros.pagina - 1 })}>
            Anterior
          </Boton>
          <span>
            Página {filtros.pagina} de {paginas}
          </span>
          <Boton variante="secundario" disabled={filtros.pagina >= paginas} onClick={() => setFiltros({ ...filtros, pagina: filtros.pagina + 1 })}>
            Siguiente
          </Boton>
        </nav>
      ) : null}
    </PaginaPanel>
  );
}
