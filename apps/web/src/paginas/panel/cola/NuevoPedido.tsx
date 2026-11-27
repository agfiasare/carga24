import { calcularCarga, formatearPesos, type MedioPago, type TipoPedido } from '@carga24/shared';
import { Search, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { jugadores, type CuentaJugador, type JugadorPanel } from '../../../api/gestion';
import { pedidos, type Pedido } from '../../../api/pedidos';
import { useAccion } from '../../../api/useAccion';
import { useConsulta } from '../../../api/useConsulta';
import { formatearTelefono, leerPesos } from '../../../comun/formato';
import { Aviso, Boton, Campo, CampoFormulario, Modal, SelectorFormulario } from '../../../componentes';
import { usePermisos } from '../PaginaPanel';
import clases from './cola.module.css';

const MEDIOS: Record<TipoPedido, { valor: MedioPago; texto: string }[]> = {
  carga: [
    { valor: 'otra_cuenta', texto: 'Transferencia desde otra cuenta' },
    { valor: 'cuenta_registrada', texto: 'Transferencia desde una cuenta del jugador' },
    { valor: 'efectivo', texto: 'Efectivo' },
  ],
  retiro: [
    { valor: 'cuenta_registrada', texto: 'Transferencia a una cuenta verificada' },
    { valor: 'efectivo', texto: 'Efectivo' },
  ],
};

/** Registrar un pedido que llegó por WhatsApp (o por teléfono). */
export function NuevoPedido({ alCerrar, alCrear }: { alCerrar: () => void; alCrear: (pedido: Pedido, avisoComprobante?: string) => void }) {
  const { tiene } = usePermisos();
  const { datos: parametros } = useConsulta(pedidos.parametros, []);
  const [tipo, setTipo] = useState<TipoPedido>('carga');
  const [jugador, setJugador] = useState<JugadorPanel | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<JugadorPanel[]>([]);
  const [telefono, setTelefono] = useState('');
  const [plataformaId, setPlataformaId] = useState('');
  const [montoTexto, setMontoTexto] = useState('');
  const [medioPago, setMedioPago] = useState<MedioPago>('otra_cuenta');
  const [cuentaId, setCuentaId] = useState('');
  const [cuentas, setCuentas] = useState<CuentaJugador[]>([]);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [nota, setNota] = useState('');
  const [codigoPromo, setCodigoPromo] = useState('');
  const creacion = useAccion(pedidos.crear);
  const buscarJugadores = tiene('jugadores.ver');

  useEffect(() => {
    if (parametros && !plataformaId) setPlataformaId(parametros.plataformas[0]?.id ?? '');
  }, [parametros, plataformaId]);

  useEffect(() => {
    if (!buscarJugadores || busqueda.trim().length < 2) {
      setResultados([]);
      return;
    }
    let vigente = true;
    const espera = setTimeout(() => {
      jugadores
        .listar(busqueda.trim(), 1)
        .then((r) => vigente && setResultados(r.jugadores.slice(0, 6)))
        .catch(() => undefined);
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [busqueda, buscarJugadores]);

  useEffect(() => {
    setCuentaId('');
    if (!jugador) {
      setCuentas([]);
      return;
    }
    jugadores.cuentas(jugador.id).then(setCuentas, () => setCuentas([]));
  }, [jugador]);

  useEffect(() => {
    setMedioPago(tipo === 'carga' ? 'otra_cuenta' : 'cuenta_registrada');
    setCuentaId('');
  }, [tipo]);

  const monto = leerPesos(montoTexto);
  const cuentasValidas = cuentas.filter((c) => (tipo === 'retiro' ? c.estado === 'verificada' : c.estado !== 'rechazada'));
  const calculo = tipo === 'carga' && monto && parametros ? calcularCarga(monto, parametros.comision.porcentajePb, parametros.comision.modo, parametros.comision.impuestoPb) : null;
  const etiquetaMonto =
    tipo === 'retiro' ? 'Monto a retirar' : parametros?.comision.modo === 'descuento' ? 'Monto que transfiere' : 'Monto a cargar';

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!monto || !parametros) return;
    const resultado = await creacion.ejecutar({
      tipo,
      ...(jugador ? { jugadorId: jugador.id } : { telefono }),
      plataformaId,
      monto,
      medioPago,
      ...(medioPago === 'cuenta_registrada' && cuentaId ? { cuentaId } : {}),
      ...(nota.trim() ? { nota: nota.trim() } : {}),
      ...(tipo === 'carga' && codigoPromo.trim() ? { codigoPromo: codigoPromo.trim() } : {}),
    });
    if (!resultado) return;
    let avisoComprobante: string | undefined;
    if (archivo) {
      try {
        await pedidos.adjuntar(resultado.valor.id, archivo);
      } catch (e) {
        avisoComprobante = `El pedido #${resultado.valor.id} se registró, pero no se pudo subir el comprobante: ${(e as Error).message}`;
      }
    }
    alCrear(resultado.valor, avisoComprobante);
  }

  const listo = Boolean(monto && plataformaId && (jugador || telefono.trim()) && (medioPago !== 'cuenta_registrada' || cuentaId));
  const error = creacion.error;

  return (
    <Modal
      titulo="Registrar pedido"
      alCerrar={alCerrar}
      acciones={
        <>
          <Boton variante="secundario" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-nuevo-pedido" cargando={creacion.cargando} disabled={!listo}>
            Registrar {tipo}
          </Boton>
        </>
      }
    >
      <form id="form-nuevo-pedido" className={clases.formulario} onSubmit={enviar} noValidate>
        {error && error.errores.length === 0 ? <Aviso tipo="error">{error.message}</Aviso> : null}
        <fieldset className={clases.segmentos}>
          <legend className={clases.etiqueta}>Tipo</legend>
          {(['carga', 'retiro'] as const).map((t) => (
            <label key={t} className={tipo === t ? clases.segmentoActivo : clases.segmento}>
              <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} />
              {t === 'carga' ? 'Carga' : 'Retiro'}
            </label>
          ))}
        </fieldset>

        <div className={clases.grupo}>
          <span className={clases.etiqueta}>Jugador</span>
          {jugador ? (
            <div className={clases.elegido}>
              <span>
                <strong>{jugador.nombreUsuario ?? formatearTelefono(jugador.telefono)}</strong>
                <span className={clases.secundario}> · {formatearTelefono(jugador.telefono)} · {jugador.usuarioPlataforma}</span>
              </span>
              <button type="button" className={clases.quitar} onClick={() => setJugador(null)} aria-label="Cambiar jugador">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <>
              {buscarJugadores ? (
                <>
                  <Campo icono={<Search size={18} />} placeholder="Buscar por usuario o teléfono" aria-label="Buscar jugador" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                  {resultados.length > 0 ? (
                    <ul className={clases.resultados} aria-label="Jugadores encontrados">
                      {resultados.map((j) => (
                        <li key={j.id}>
                          <button type="button" onClick={() => setJugador(j)} disabled={j.estado === 'bloqueado'}>
                            <strong>{j.nombreUsuario ?? formatearTelefono(j.telefono)}</strong> {formatearTelefono(j.telefono)}
                            {j.estado === 'bloqueado' ? ' · bloqueado' : ''}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : null}
              <CampoFormulario
                etiqueta={buscarJugadores ? '…o el teléfono, si todavía no tiene cuenta' : 'Teléfono del jugador'}
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                ayuda="Cuando se registre con ese número, el pedido pasa a su cuenta."
              />
            </>
          )}
        </div>

        <div className={clases.dosCampos}>
          <CampoFormulario
            etiqueta={etiquetaMonto}
            inputMode="decimal"
            placeholder="0"
            value={montoTexto}
            onChange={(e) => setMontoTexto(e.target.value)}
            error={montoTexto && !monto ? 'Escribí un monto válido, por ejemplo 10.000' : error?.delCampo('monto')}
          />
          <SelectorFormulario
            etiqueta="Plataforma"
            opciones={(parametros?.plataformas ?? []).map((p) => ({ valor: p.id, texto: p.nombre }))}
            value={plataformaId}
            onChange={(e) => setPlataformaId(e.target.value)}
          />
        </div>
        {calculo && parametros ? (
          <p className={clases.calculo} aria-live="polite">
            Transfiere <strong>{formatearPesos(calculo.pagado)}</strong> · se acreditan <strong>{formatearPesos(calculo.acreditado)}</strong> · comisión{' '}
            {formatearPesos(calculo.ganancia)} ({parametros.comision.porcentajePb / 100} % {parametros.comision.modo})
          </p>
        ) : null}
        {tipo === 'retiro' && parametros?.retiro && parametros.retiro.comisionPb > 0 ? (
          <p className={clases.calculo}>
            Si el jugador no cargó con nosotros{parametros.retiro.diasSinCarga ? ` en los últimos ${parametros.retiro.diasSinCarga} días` : ''}, se descuenta una comisión del{' '}
            {String(parametros.retiro.comisionPb / 100).replace('.', ',')} % de lo que se le transfiere. El detalle del pedido lo muestra.
          </p>
        ) : null}

        <SelectorFormulario etiqueta="Medio de pago" opciones={MEDIOS[tipo]} value={medioPago} onChange={(e) => setMedioPago(e.target.value as MedioPago)} />
        {medioPago === 'cuenta_registrada' ? (
          cuentasValidas.length > 0 ? (
            <SelectorFormulario
              etiqueta={tipo === 'carga' ? 'Cuenta de origen' : 'Cuenta de destino'}
              vacio="Elegí una cuenta"
              opciones={cuentasValidas.map((c) => ({ valor: c.id, texto: `${c.alias ?? c.cbuCvu}${c.estado === 'pendiente' ? ' (pendiente)' : ''}` }))}
              value={cuentaId}
              onChange={(e) => setCuentaId(e.target.value)}
            />
          ) : (
            <Aviso tipo="info">{jugador ? (tipo === 'retiro' ? 'El jugador no tiene cuentas verificadas: los retiros van solo a cuentas verificadas.' : 'El jugador no tiene cuentas cargadas.') : 'Elegí primero el jugador.'}</Aviso>
          )
        ) : null}

        {tipo === 'carga' ? (
          <label className={clases.campoArchivo}>
            <span>Comprobante (opcional)</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
          </label>
        ) : null}
        {tipo === 'carga' && tiene('promos.aplicar') ? (
          <CampoFormulario etiqueta="Código de promo (opcional)" value={codigoPromo} onChange={(e) => setCodigoPromo(e.target.value.toUpperCase())} autoCapitalize="characters" />
        ) : null}
        <CampoFormulario etiqueta="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} />
      </form>
    </Modal>
  );
}
