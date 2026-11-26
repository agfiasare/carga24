import { formatearPesos, type EstadoPedido } from '@carga24/shared';
import { Download } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { administracion, fechaRelativa, type FiltrosPedidos } from '../../api/administracion';
import { useConsulta } from '../../api/useConsulta';
import { formatearFecha, formatearHora } from '../../comun/formato';
import { Aviso, Boton, Campo, InsigniaEstado, Selector } from '../../componentes';
import { ListaPedidos } from './ListaPedidos';
import { PaginaPanel, usePermisos } from './PaginaPanel';
import clases from './panel.module.css';
import propias from './reportes.module.css';

const PERIODOS = [
  { clave: 'hoy', texto: 'Hoy', dias: 0 },
  { clave: '7', texto: '7 días', dias: 6 },
  { clave: '30', texto: '30 días', dias: 29 },
];

const ESTADOS: { valor: EstadoPedido; texto: string }[] = [
  { valor: 'acreditado', texto: 'Acreditados' },
  { valor: 'pagado', texto: 'Pagados' },
  { valor: 'rechazado', texto: 'Rechazados' },
  { valor: 'pendiente', texto: 'Pendientes' },
  { valor: 'en_proceso', texto: 'En proceso' },
  { valor: 'verificado', texto: 'Por acreditar / pagar' },
];

/** Ganancia y movimientos por período, con el detalle de pedidos y exportación a Excel. */
export function Reportes() {
  const { tiene } = usePermisos();
  const [periodo, setPeriodo] = useState('hoy');
  const [desde, setDesde] = useState(fechaRelativa());
  const [hasta, setHasta] = useState(fechaRelativa());
  const [filtros, setFiltros] = useState<Omit<FiltrosPedidos, 'desde' | 'hasta'>>({ estado: '', tipo: '', canal: '', buscar: '', pagina: 1 });
  const [buscar, setBuscar] = useState('');
  const valido = Boolean(desde && hasta && desde <= hasta);
  const resumen = useConsulta(() => (valido ? administracion.resumen(desde, hasta) : Promise.resolve(undefined)), [desde, hasta, valido]);
  const pedidos = useConsulta(() => (valido ? administracion.pedidos({ desde, hasta, ...filtros }) : Promise.resolve(undefined)), [desde, hasta, filtros, valido]);

  useEffect(() => {
    const espera = setTimeout(() => setFiltros((f) => ({ ...f, buscar: buscar.trim(), pagina: 1 })), 300);
    return () => clearTimeout(espera);
  }, [buscar]);

  function elegirPeriodo(clave: string, dias: number) {
    setPeriodo(clave);
    setDesde(fechaRelativa(-dias));
    setHasta(fechaRelativa());
    setFiltros((f) => ({ ...f, pagina: 1 }));
  }

  const r = resumen.datos;
  const lista = pedidos.datos;
  const paginas = lista ? Math.max(1, Math.ceil(lista.total / lista.porPagina)) : 1;
  const cambiarFiltro = (campo: keyof typeof filtros) => (e: { target: { value: string } }) => setFiltros({ ...filtros, [campo]: e.target.value, pagina: 1 });

  return (
    <PaginaPanel titulo="Reportes" requiere={['reportes.ver']}>
      <div className={propias.periodo} role="group" aria-label="Período">
        {PERIODOS.map((p) => (
          <button key={p.clave} type="button" className={periodo === p.clave ? propias.chipActivo : propias.chip} aria-pressed={periodo === p.clave} onClick={() => elegirPeriodo(p.clave, p.dias)}>
            {p.texto}
          </button>
        ))}
        <label className={propias.fecha}>
          Desde
          <Campo type="date" value={desde} max={hasta} onChange={(e) => { setPeriodo('rango'); setDesde(e.target.value); }} />
        </label>
        <label className={propias.fecha}>
          Hasta
          <Campo type="date" value={hasta} min={desde} onChange={(e) => { setPeriodo('rango'); setHasta(e.target.value); }} />
        </label>
      </div>
      {!valido ? <Aviso tipo="error">Elegí un rango válido.</Aviso> : null}
      {resumen.error ? <Aviso tipo="error">{resumen.error.message}</Aviso> : null}

      {r ? (
        <>
          <div className={propias.indicadores}>
            <Indicador titulo="Ganancia" valor={formatearPesos(r.totales.ganancia)} destacado />
            <Indicador titulo="Cargas acreditadas" valor={formatearPesos(r.totales.cargas.acreditado)} detalle={`${r.totales.cargas.cantidad} · transferido ${formatearPesos(r.totales.cargas.transferido)}`} />
            <Indicador titulo="Retiros pagados" valor={formatearPesos(r.totales.retiros.pagado)} detalle={`${r.totales.retiros.cantidad} retiros`} />
            <Indicador titulo="Rechazados / en curso" valor={`${r.totales.rechazados} / ${r.totales.enCurso}`} detalle={`de ${r.totales.pedidos} pedidos`} />
          </div>

          <Desglose
            titulo="Por canal"
            desde={desde}
            hasta={hasta}
            columnas={['Canal', 'Pedidos', 'Cargas', 'Retiros', 'Ganancia', 'Rechazados']}
            filas={r.porCanal.map((c) => ({ clave: c.canal, celdas: [c.canal === 'manual' ? 'WhatsApp' : 'Web', c.pedidos, formatearPesos(c.cargas), formatearPesos(c.retiros), formatearPesos(c.ganancia), c.rechazados], filtros: { canal: c.canal } }))}
          />
          <Desglose
            titulo="Por operador"
            desde={desde}
            hasta={hasta}
            columnas={['Operador', 'Pedidos', 'Acreditado', 'Pagado', 'Ganancia', 'Rechazados']}
            filas={r.porOperador.map((o) => ({ clave: o.id ?? 'sin', celdas: [o.nombre, o.pedidos, formatearPesos(o.acreditado), formatearPesos(o.pagado), formatearPesos(o.ganancia), o.rechazados], filtros: o.id ? { operadorId: o.id } : null }))}
          />
          <Desglose
            titulo="Por día"
            desde={desde}
            hasta={hasta}
            columnas={['Día', 'Pedidos', 'Cargas', 'Retiros', 'Ganancia', 'Rechazados']}
            filas={r.porDia.map((d) => ({ clave: d.fecha, celdas: [formatearFecha(`${d.fecha}T12:00:00-03:00`), d.pedidos, formatearPesos(d.cargas), formatearPesos(d.retiros), formatearPesos(d.ganancia), d.rechazados], filtros: { desde: d.fecha, hasta: d.fecha } }))}
          />
          <Desglose
            titulo="Jugadores que más cargaron"
            desde={desde}
            hasta={hasta}
            columnas={['Jugador', 'Pedidos', 'Cargado', 'Retirado', 'Rechazados']}
            filas={r.porJugador.map((j) => ({
              clave: j.id ?? `tel:${j.telefono}`,
              celdas: [j.jugador, j.pedidos, formatearPesos(j.cargado), formatearPesos(j.retirado), j.rechazados],
              filtros: j.id ? { jugadorId: j.id } : j.telefono ? { buscar: j.telefono } : null,
            }))}
          />
          <p className={clases.total}>Cuentan los pedidos creados en el período. Los montos suman solo cargas acreditadas y retiros pagados; los rechazados se cuentan aparte. Tocá una fila para ver sus pedidos.</p>
        </>
      ) : null}

      <section className={clases.tarjeta} aria-labelledby="titulo-pedidos">
        <div className={clases.barra}>
          <h2 id="titulo-pedidos">Pedidos {lista ? <span className={clases.total}>({lista.total})</span> : null}</h2>
          {tiene('reportes.exportar') && valido ? (
            <a className={propias.exportar} href={administracion.urlExcel({ desde, hasta, ...filtros })} download>
              <Download size={18} aria-hidden="true" /> Exportar a Excel
            </a>
          ) : null}
        </div>
        <div className={propias.filtros}>
          <Campo type="search" placeholder="N°, jugador, teléfono u operación" aria-label="Buscar pedidos" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          <Selector aria-label="Estado" vacio="Todos los estados" opciones={ESTADOS} value={filtros.estado} onChange={cambiarFiltro('estado')} />
          <Selector aria-label="Tipo" vacio="Cargas y retiros" opciones={[{ valor: 'carga', texto: 'Cargas' }, { valor: 'retiro', texto: 'Retiros' }]} value={filtros.tipo} onChange={cambiarFiltro('tipo')} />
          <Selector aria-label="Canal" vacio="Web y WhatsApp" opciones={[{ valor: 'web', texto: 'Web' }, { valor: 'manual', texto: 'WhatsApp' }]} value={filtros.canal} onChange={cambiarFiltro('canal')} />
        </div>
        {pedidos.error ? <Aviso tipo="error">{pedidos.error.message}</Aviso> : null}
        <div className={clases.envoltorioTabla}>
          <table className={clases.tabla}>
            <thead>
              <tr>
                <th scope="col">N°</th>
                <th scope="col">Fecha</th>
                <th scope="col">Jugador</th>
                <th scope="col">Canal</th>
                <th scope="col">Monto</th>
                <th scope="col">Ganancia</th>
                <th scope="col">Operador</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {lista?.pedidos.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.tipo === 'carga' ? 'Carga' : 'Retiro'} #{p.id}
                  </td>
                  <td>
                    {formatearFecha(p.creadoEn)} {formatearHora(p.creadoEn)}
                  </td>
                  <td>{p.jugador ?? '—'}</td>
                  <td>{p.canal === 'manual' ? 'WhatsApp' : 'Web'}</td>
                  <td>{formatearPesos(p.monto)}</td>
                  <td>{p.estado === 'acreditado' || p.estado === 'pagado' ? formatearPesos(p.ganancia) : '—'}</td>
                  <td>{p.operador ?? '—'}</td>
                  <td>
                    <InsigniaEstado estado={p.estado} tipo={p.tipo} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {lista && lista.total === 0 ? <p className={clases.vacio}>No hay pedidos con esos filtros.</p> : null}
        </div>
        {paginas > 1 ? (
          <nav className={clases.paginacion} aria-label="Páginas">
            <Boton variante="secundario" disabled={(filtros.pagina ?? 1) <= 1} onClick={() => setFiltros({ ...filtros, pagina: (filtros.pagina ?? 1) - 1 })}>
              Anterior
            </Boton>
            <span>
              Página {filtros.pagina} de {paginas}
            </span>
            <Boton variante="secundario" disabled={(filtros.pagina ?? 1) >= paginas} onClick={() => setFiltros({ ...filtros, pagina: (filtros.pagina ?? 1) + 1 })}>
              Siguiente
            </Boton>
          </nav>
        ) : null}
      </section>
    </PaginaPanel>
  );
}

function Indicador({ titulo, valor, detalle, destacado = false }: { titulo: string; valor: string; detalle?: string; destacado?: boolean }) {
  return (
    <div className={`${propias.indicador} ${destacado ? propias.destacado : ''}`}>
      <span className={propias.indicadorTitulo}>{titulo}</span>
      <span className={propias.indicadorValor}>{valor}</span>
      {detalle ? <span className={propias.indicadorDetalle}>{detalle}</span> : null}
    </div>
  );
}

interface FilaDesglose {
  clave: string;
  celdas: (string | number)[];
  /** Filtros que traen los pedidos de esta fila; null si no se pueden listar. */
  filtros: Partial<FiltrosPedidos> | null;
}

/** Un desglose plegable: cada fila se abre y muestra sus pedidos (también los rechazados). */
function Desglose({ titulo, columnas, filas, desde, hasta }: { titulo: string; columnas: string[]; filas: FilaDesglose[]; desde: string; hasta: string }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  return (
    <details className={clases.plegable}>
      <summary>
        <span>
          {titulo}
          <small>
            {filas.length} {filas.length === 1 ? 'fila' : 'filas'}
          </small>
        </span>
      </summary>
      <div className={clases.plegableCuerpo}>
        {filas.length === 0 ? (
          <p className={clases.explicacion}>Sin movimientos.</p>
        ) : (
          <div className={clases.envoltorioTabla}>
            <table className={clases.tabla}>
              <thead>
                <tr>
                  {columnas.map((c, i) => (
                    <th key={c} scope="col" className={i > 0 ? propias.numero : undefined}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => {
                  const abiertaEsta = abierta === fila.clave;
                  return (
                    <Fragment key={fila.clave}>
                      <tr>
                        {fila.celdas.map((celda, j) => (
                          <td key={j} className={j > 0 ? propias.numero : undefined}>
                            {j === 0 && fila.filtros ? (
                              <button type="button" className={clases.enlaceBoton} aria-expanded={abiertaEsta} onClick={() => setAbierta(abiertaEsta ? null : fila.clave)}>
                                {abiertaEsta ? '▾' : '▸'} {celda}
                              </button>
                            ) : (
                              celda
                            )}
                          </td>
                        ))}
                      </tr>
                      {abiertaEsta && fila.filtros ? (
                        <tr>
                          <td colSpan={columnas.length} className={propias.detalleFila}>
                            <PedidosDelGrupo filtros={{ desde, hasta, ...fila.filtros, pagina: 1 }} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  );
}

function PedidosDelGrupo({ filtros }: { filtros: FiltrosPedidos }) {
  const { datos, error } = useConsulta(() => administracion.pedidos(filtros), [JSON.stringify(filtros)]);
  if (error) return <Aviso tipo="error">{error.message}</Aviso>;
  if (!datos) return null;
  return (
    <>
      <ListaPedidos pedidos={datos.pedidos} conJugador />
      {datos.total > datos.pedidos.length ? (
        <p className={clases.explicacion}>
          Se muestran {datos.pedidos.length} de {datos.total}. Para ver todos, filtrá el listado de abajo.
        </p>
      ) : null}
    </>
  );
}
