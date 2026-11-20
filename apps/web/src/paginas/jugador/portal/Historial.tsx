import { useEffect, useState } from 'react';
import { portal, type PedidoJugador } from '../../../api/portal';
import { useConsulta } from '../../../api/useConsulta';
import { Aviso, Boton } from '../../../componentes';
import { usePortalEnVivo } from '../../../sesion/portalEnVivo';
import { FilaPedido, PaginaJugador } from './comun';
import clases from './portal.module.css';

const FILTROS = [
  { clave: '', texto: 'Todos', filtro: {} },
  { clave: 'en_curso', texto: 'En curso', filtro: { estado: 'en_curso' } },
  { clave: 'carga', texto: 'Cargas', filtro: { tipo: 'carga' } },
  { clave: 'retiro', texto: 'Retiros', filtro: { tipo: 'retiro' } },
  { clave: 'cerrados', texto: 'Terminados', filtro: { estado: 'cerrados' } },
];

export function Historial() {
  const { version } = usePortalEnVivo();
  const [filtro, setFiltro] = useState('');
  const [pagina, setPagina] = useState(1);
  const [acumulados, setAcumulados] = useState<PedidoJugador[]>([]);
  const elegido = FILTROS.find((f) => f.clave === filtro)!;
  const { datos, error, cargando } = useConsulta(() => portal.pedidos({ ...elegido.filtro, pagina }), [filtro, pagina, version]);

  useEffect(() => {
    if (!datos) return;
    setAcumulados((anteriores) => (datos.pagina === 1 ? datos.pedidos : [...anteriores.filter((p) => !datos.pedidos.some((n) => n.id === p.id)), ...datos.pedidos]));
  }, [datos]);

  function elegir(clave: string) {
    setFiltro(clave);
    setPagina(1);
  }

  const hayMas = datos ? datos.pagina * datos.porPagina < datos.total : false;
  return (
    <PaginaJugador titulo="Tus pedidos">
      <div className={clases.filtros} role="group" aria-label="Filtrar pedidos">
        {FILTROS.map((f) => (
          <button key={f.clave} type="button" className={filtro === f.clave ? clases.chipActivo : clases.chip} aria-pressed={filtro === f.clave} onClick={() => elegir(f.clave)}>
            {f.texto}
          </button>
        ))}
      </div>
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      <div className={clases.lista}>
        {acumulados.map((p) => (
          <FilaPedido key={p.id} pedido={p} />
        ))}
      </div>
      {datos && datos.total === 0 ? <p className={clases.vacio}>Todavía no hay pedidos acá.</p> : null}
      {hayMas ? (
        <Boton variante="secundario" cargando={cargando} onClick={() => setPagina(pagina + 1)}>
          Ver más
        </Boton>
      ) : null}
    </PaginaJugador>
  );
}
