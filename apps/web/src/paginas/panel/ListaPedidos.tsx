import { formatearPesos, type EstadoPedido, type TipoPedido } from '@carga24/shared';
import { useState } from 'react';
import { formatearFecha, formatearHora } from '../../comun/formato';
import { InsigniaEstado } from '../../componentes';
import { DetallePedido } from './cola/DetallePedido';
import { usePermisos } from './PaginaPanel';
import clases from './panel.module.css';
import propias from './reportes.module.css';

export interface FilaPedido {
  id: number;
  tipo: TipoPedido;
  estado: EstadoPedido;
  canal: 'web' | 'manual';
  monto: number;
  creadoEn: string;
  jugador?: string | null;
  operador: string | null;
  motivoRechazo?: string | null;
}

/**
 * Tabla compacta de pedidos (ficha del jugador, desgloses de reportes).
 * Con pedidos.ver, cada número abre el detalle con sus comprobantes e historial.
 */
export function ListaPedidos({ pedidos, conJugador = false, vacio = 'Sin pedidos.' }: { pedidos: FilaPedido[]; conJugador?: boolean; vacio?: string }) {
  const { tiene } = usePermisos();
  const [abierto, setAbierto] = useState<number | null>(null);
  if (pedidos.length === 0) return <p className={clases.vacio}>{vacio}</p>;
  return (
    <div className={clases.envoltorioTabla}>
      <table className={clases.tabla}>
        <thead>
          <tr>
            <th scope="col">Pedido</th>
            <th scope="col">Fecha</th>
            {conJugador ? <th scope="col">Jugador</th> : null}
            <th scope="col">Canal</th>
            <th scope="col" className={propias.numero}>Monto</th>
            <th scope="col">Operador</th>
            <th scope="col">Estado</th>
          </tr>
        </thead>
        <tbody>
          {pedidos.map((p) => {
            const texto = `${p.tipo === 'carga' ? 'Carga' : 'Retiro'} #${p.id}`;
            return (
              <tr key={p.id}>
                <td>
                  {tiene('pedidos.ver') ? (
                    <button type="button" className={clases.enlaceBoton} onClick={() => setAbierto(p.id)}>
                      {texto}
                    </button>
                  ) : (
                    texto
                  )}
                </td>
                <td>
                  {formatearFecha(p.creadoEn)} {formatearHora(p.creadoEn)}
                </td>
                {conJugador ? <td>{p.jugador ?? '—'}</td> : null}
                <td>{p.canal === 'manual' ? 'WhatsApp' : 'Web'}</td>
                <td className={propias.numero}>{formatearPesos(p.monto)}</td>
                <td>{p.operador ?? '—'}</td>
                <td>
                  <InsigniaEstado estado={p.estado} tipo={p.tipo} />
                  {p.motivoRechazo ? <span className={clases.secundario}>{p.motivoRechazo}</span> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {abierto !== null ? <DetallePedido id={abierto} alCerrar={() => setAbierto(null)} /> : null}
    </div>
  );
}
