import { columnaDe, type ColumnaCola } from '@carga24/shared';
import { Bell, BellOff, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { pedidos, type Pedido } from '../../../api/pedidos';
import { useAccion } from '../../../api/useAccion';
import { useColaEnVivo, sonarAviso, type AvisoCola } from '../../../api/useColaEnVivo';
import { useConsulta } from '../../../api/useConsulta';
import { formatearHace, formatearHora } from '../../../comun/formato';
import { Aviso, Boton, Selector, TarjetaPedido } from '../../../componentes';
import { useSesionStaff } from '../../../sesion/sesion';
import { PaginaPanel, usePermisos } from '../PaginaPanel';
import { nombreJugador } from './comun';
import { DetallePedido } from './DetallePedido';
import { ModalAccion, type AccionModal } from './ModalesPedido';
import { NuevoPedido } from './NuevoPedido';
import clases from './cola.module.css';

const COLUMNAS: { clave: ColumnaCola; titulo: string }[] = [
  { clave: 'pendientes', titulo: 'Pendientes' },
  { clave: 'en_proceso', titulo: 'En proceso' },
  { clave: 'por_completar', titulo: 'Por acreditar / pagar' },
  { clave: 'cerrados', titulo: 'Cerrados hoy' },
];

const CLAVE_SONIDO = 'carga24.cola.sonido';

function leerSonido(): boolean {
  try {
    return localStorage.getItem(CLAVE_SONIDO) !== 'no';
  } catch {
    return true;
  }
}

/** Cola unificada: pedidos web y de WhatsApp, en vivo, con un responsable por columna. */
export function Cola() {
  const { usuario } = useSesionStaff();
  const { tiene } = usePermisos();
  const { datos, error, recargar } = useConsulta(pedidos.cola, []);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroCanal, setFiltroCanal] = useState('');
  const [sonido, setSonido] = useState(leerSonido);
  const [nuevos, setNuevos] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<{ accion: AccionModal; pedido: Pedido } | null>(null);
  const [detalle, setDetalle] = useState<number | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const liberacion = useAccion(pedidos.liberar);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Muchos avisos juntos → una sola recarga.
  const recargarPronto = useCallback(() => {
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(recargar, 250);
  }, [recargar]);

  useColaEnVivo((e: AvisoCola) => {
    recargarPronto();
    if (e.tipo === 'pedido.creado' && e.actorId !== usuario?.id) {
      if (sonido) sonarAviso();
      setNuevos((actual) => new Set(actual).add(e.pedidoId));
      setTimeout(() => setNuevos((actual) => {
        const copia = new Set(actual);
        copia.delete(e.pedidoId);
        return copia;
      }), 8000);
    }
  }, recargar);

  // Las horas relativas ("hace 5 min") se refrescan solas.
  const [, setTic] = useState(0);
  useEffect(() => {
    const intervalo = setInterval(() => setTic((t) => t + 1), 30_000);
    return () => clearInterval(intervalo);
  }, []);

  const visibles = useMemo(
    () => (datos ?? []).filter((p) => (!filtroTipo || p.tipo === filtroTipo) && (!filtroCanal || p.canal === filtroCanal)),
    [datos, filtroTipo, filtroCanal],
  );
  const porColumna = useMemo(() => {
    const grupos: Record<ColumnaCola, Pedido[]> = { pendientes: [], en_proceso: [], por_completar: [], cerrados: [] };
    for (const p of visibles) grupos[columnaDe(p.estado)].push(p);
    grupos.cerrados.sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
    return grupos;
  }, [visibles]);
  const pendientes = (datos ?? []).filter((p) => p.estado === 'pendiente').length;

  useEffect(() => {
    const anterior = document.title;
    document.title = pendientes > 0 ? `(${pendientes}) Cola · Carga24` : 'Cola · Carga24';
    return () => {
      document.title = anterior;
    };
  }, [pendientes]);

  function alternarSonido() {
    const nuevo = !sonido;
    setSonido(nuevo);
    try {
      localStorage.setItem(CLAVE_SONIDO, nuevo ? 'si' : 'no');
    } catch {
      /* sin almacenamiento: queda solo para esta visita */
    }
    if (nuevo) sonarAviso();
  }

  async function liberar(p: Pedido) {
    if (await liberacion.ejecutar(p.id)) recargar();
  }

  function accionesDe(p: Pedido) {
    const botones: { texto: string; alHacer: () => void; variante?: 'primario' | 'secundario' | 'peligro' | 'fantasma' }[] = [];
    const abrir = (accion: AccionModal) => () => setModal({ accion, pedido: p });
    const mio = p.tomadoPor?.id === usuario?.id;
    switch (p.estado) {
      case 'pendiente':
        if (tiene('pedidos.tomar')) botones.push({ texto: 'Tomar', alHacer: abrir('tomar') });
        if (tiene('pedidos.rechazar')) botones.push({ texto: 'Rechazar', alHacer: abrir('rechazar'), variante: 'fantasma' });
        break;
      case 'en_proceso':
        if (!mio) break;
        if (tiene('pedidos.verificar')) botones.push({ texto: p.tipo === 'carga' ? 'Verificar pago' : 'Validar retiro', alHacer: abrir('verificar') });
        if (tiene('pedidos.rechazar')) {
          botones.push(p.tipo === 'carga' && p.medioPago !== 'efectivo' ? { texto: 'No llegó', alHacer: abrir('no_llego'), variante: 'secundario' } : { texto: 'Rechazar', alHacer: abrir('rechazar'), variante: 'secundario' });
        }
        botones.push({ texto: 'Liberar', alHacer: () => void liberar(p), variante: 'fantasma' });
        break;
      case 'espera_aprobacion':
        if (tiene('pedidos.aprobar_retiro')) botones.push({ texto: 'Aprobar', alHacer: abrir('aprobar') });
        if (tiene('pedidos.aprobar_retiro') && tiene('pedidos.rechazar')) botones.push({ texto: 'Rechazar', alHacer: abrir('rechazar'), variante: 'fantasma' });
        break;
      case 'verificado':
        if (p.tipo === 'carga' && tiene('pedidos.acreditar')) botones.push({ texto: 'Marcar acreditada', alHacer: abrir('acreditar') });
        if (p.tipo === 'retiro' && tiene('pedidos.pagar')) botones.push({ texto: 'Marcar pagado', alHacer: abrir('pagar') });
        break;
    }
    if (botones.length === 0) return undefined;
    return botones.map((b) => (
      <Boton key={b.texto} variante={b.variante ?? 'primario'} onClick={b.alHacer}>
        {b.texto}
      </Boton>
    ));
  }

  return (
    <PaginaPanel
      titulo="Cola de pedidos"
      requiere={['pedidos.ver']}
      acciones={
        <>
          <Boton variante="secundario" onClick={alternarSonido} aria-pressed={sonido} icono={sonido ? <Bell size={18} aria-hidden="true" /> : <BellOff size={18} aria-hidden="true" />}>
            {sonido ? 'Sonido activado' : 'Sonido apagado'}
          </Boton>
          {tiene('pedidos.crear') ? (
            <Boton icono={<Plus size={18} aria-hidden="true" />} onClick={() => setRegistrando(true)}>
              Registrar pedido
            </Boton>
          ) : null}
        </>
      }
    >
      <div className={clases.filtros}>
        <Selector aria-label="Tipo" vacio="Cargas y retiros" opciones={[{ valor: 'carga', texto: 'Solo cargas' }, { valor: 'retiro', texto: 'Solo retiros' }]} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} />
        <Selector aria-label="Canal" vacio="Web y WhatsApp" opciones={[{ valor: 'web', texto: 'Solo web' }, { valor: 'manual', texto: 'Solo WhatsApp' }]} value={filtroCanal} onChange={(e) => setFiltroCanal(e.target.value)} />
      </div>
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      {liberacion.error ? <Aviso tipo="error">{liberacion.error.message}</Aviso> : null}
      {aviso ? <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso> : null}

      <div className={clases.tablero}>
        {COLUMNAS.map((columna) => (
          <section key={columna.clave} className={clases.columna} aria-labelledby={`columna-${columna.clave}`}>
            <h2 id={`columna-${columna.clave}`} className={clases.tituloColumna}>
              {columna.titulo}
              <span className={clases.contador}>{porColumna[columna.clave].length}</span>
            </h2>
            <div className={clases.lista}>
              {porColumna[columna.clave].map((p) => (
                <TarjetaPedido
                  key={p.id}
                  nuevo={nuevos.has(p.id)}
                  alAbrir={() => setDetalle(p.id)}
                  acciones={accionesDe(p)}
                  pedido={{
                    ...p,
                    jugador: nombreJugador(p),
                    cuando: columna.clave === 'cerrados' ? formatearHora(p.actualizadoEn) : formatearHace(p.creadoEn),
                    tomadoPor: p.tomadoPor ? (p.tomadoPor.id === usuario?.id ? 'Vos' : p.tomadoPor.nombre) : null,
                    comprobantes: p.comprobantes.length,
                  }}
                />
              ))}
              {datos && porColumna[columna.clave].length === 0 ? <p className={clases.vacia}>Nada por acá.</p> : null}
            </div>
          </section>
        ))}
      </div>

      {modal ? (
        <ModalAccion
          key={`${modal.accion}-${modal.pedido.id}`}
          pedido={modal.pedido}
          accion={modal.accion}
          alCerrar={() => {
            setModal(null);
            recargar(); // por si el error fue que otro lo tomó
          }}
          alTerminar={() => {
            setModal(null);
            setAviso(null);
            recargar();
          }}
        />
      ) : null}
      {detalle !== null ? <DetallePedido id={detalle} alCerrar={() => { setDetalle(null); recargar(); }} /> : null}
      {registrando ? (
        <NuevoPedido
          alCerrar={() => setRegistrando(false)}
          alCrear={(p, avisoComprobante) => {
            setRegistrando(false);
            setAviso(avisoComprobante ? { tipo: 'error', texto: avisoComprobante } : { tipo: 'ok', texto: `Pedido #${p.id} registrado.` });
            recargar();
          }}
        />
      ) : null}
    </PaginaPanel>
  );
}
