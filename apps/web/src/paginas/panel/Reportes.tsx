import { formatearPesos, type EstadoPedido } from '@carga24/shared';
import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { administracion, fechaRelativa, type FiltrosPedidos } from '../../api/administracion';
import { useConsulta } from '../../api/useConsulta';
import { formatearFecha, formatearHora } from '../../comun/formato';
import { Aviso, Boton, Campo, InsigniaEstado, Selector } from '../../componentes';
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

          <div className={propias.grilla}>
            <Tabla
              titulo="Por canal"
              columnas={['Canal', 'Pedidos', 'Cargas', 'Retiros', 'Ganancia']}
              filas={r.porCanal.map((c) => [c.canal === 'manual' ? 'WhatsApp' : 'Web', c.pedidos, formatearPesos(c.cargas), formatearPesos(c.retiros), formatearPesos(c.ganancia)])}
            />
            <Tabla
              titulo="Por operador"
              columnas={['Operador', 'Pedidos', 'Acreditado', 'Pagado', 'Ganancia']}
              filas={r.porOperador.map((o) => [o.nombre, o.pedidos, formatearPesos(o.acreditado), formatearPesos(o.pagado), formatearPesos(o.ganancia)])}
            />
            <Tabla
              titulo="Por día"
              columnas={['Día', 'Cargas', 'Retiros', 'Ganancia']}
              filas={r.porDia.map((d) => [formatearFecha(`${d.fecha}T12:00:00-03:00`), formatearPesos(d.cargas), formatearPesos(d.retiros), formatearPesos(d.ganancia)])}
            />
            <Tabla
              titulo="Jugadores que más cargaron"
              columnas={['Jugador', 'Pedidos', 'Cargado', 'Retirado']}
              filas={r.porJugador.map((j) => [j.jugador, j.pedidos, formatearPesos(j.cargado), formatearPesos(j.retirado)])}
            />
          </div>
          <p className={clases.total}>Cuentan los pedidos creados en el período. Los totales suman solo cargas acreditadas y retiros pagados.</p>
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

function Tabla({ titulo, columnas, filas }: { titulo: string; columnas: string[]; filas: (string | number)[][] }) {
  return (
    <section className={clases.tarjeta} aria-label={titulo}>
      <h2>{titulo}</h2>
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
              {filas.map((fila, i) => (
                <tr key={i}>
                  {fila.map((celda, j) => (
                    <td key={j} className={j > 0 ? propias.numero : undefined}>
                      {celda}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
