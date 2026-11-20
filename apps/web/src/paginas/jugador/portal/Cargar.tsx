import { calcularCarga, formatearPesos } from '@carga24/shared';
import { Check, Copy } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { portal } from '../../../api/portal';
import { useAccion } from '../../../api/useAccion';
import { useConsulta } from '../../../api/useConsulta';
import { leerPesos } from '../../../comun/formato';
import { Aviso, Boton, CampoFormulario, SelectorFormulario } from '../../../componentes';
import { PaginaJugador } from './comun';
import clases from './portal.module.css';

export function Cargar() {
  const navegar = useNavigate();
  const { datos: parametros } = useConsulta(portal.parametros, []);
  const { datos: cuentas } = useConsulta(portal.cuentas, []);
  const [montoTexto, setMontoTexto] = useState('');
  const [cuentaId, setCuentaId] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [copiado, setCopiado] = useState(false);
  const pedido = useAccion(portal.pedir);

  const monto = leerPesos(montoTexto);
  const descuento = parametros?.comision.modo === 'descuento';
  const calculo = monto && parametros ? calcularCarga(monto, parametros.comision.porcentajePb, parametros.comision.modo) : null;
  const fueraDeRango = monto && parametros ? monto < parametros.montos.cargaMinima || monto > parametros.montos.cargaMaxima : false;
  const usables = (cuentas ?? []).filter((c) => c.estado !== 'rechazada');
  const cuentaElegida = cuentaId || (usables.length === 1 ? usables[0]!.id : '');
  const listo = Boolean(monto && !fueraDeRango && cuentaElegida && archivo);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!monto || !archivo) return;
    const resultado = await pedido.ejecutar({ tipo: 'carga', monto, cuentaId: cuentaElegida, archivo });
    if (resultado) navegar(`/pedidos/${resultado.valor.id}`, { replace: true });
  }

  async function copiarAlias() {
    if (!parametros?.datosPago.alias) return;
    try {
      await navigator.clipboard.writeText(parametros.datosPago.alias);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <PaginaJugador titulo="Cargar saldo" volver={{ a: '/inicio', texto: 'Inicio' }}>
      {parametros && cuentas ? (
        <form className={clases.formulario} onSubmit={enviar} noValidate>
          {pedido.error ? <Aviso tipo="error">{pedido.error.message}</Aviso> : null}
          <CampoFormulario
            etiqueta={descuento ? '¿Cuánto vas a transferir?' : '¿Cuánto querés cargar?'}
            inputMode="decimal"
            placeholder="$ 0"
            value={montoTexto}
            onChange={(e) => setMontoTexto(e.target.value)}
            ayuda={`De ${formatearPesos(parametros.montos.cargaMinima)} a ${formatearPesos(parametros.montos.cargaMaxima)}`}
            error={montoTexto && !monto ? 'Escribí un monto válido, por ejemplo 10.000' : fueraDeRango ? 'El monto está fuera del rango permitido' : undefined}
          />
          {calculo ? (
            <dl className={clases.calculo} aria-live="polite">
              <dt>Transferís</dt>
              <dd className={clases.total}>{formatearPesos(calculo.pagado)}</dd>
              <dt>Comisión ({parametros.comision.porcentajePb / 100} %)</dt>
              <dd>{formatearPesos(calculo.ganancia)}</dd>
              <dt>Recibís en tu usuario</dt>
              <dd>{formatearPesos(calculo.acreditado)}</dd>
            </dl>
          ) : null}

          {usables.length === 0 ? (
            <Aviso tipo="info">
              Primero cargá la cuenta desde la que vas a transferir. <Link to="/cuentas">Agregar cuenta</Link>
            </Aviso>
          ) : (
            <SelectorFormulario
              etiqueta="¿Desde qué cuenta transferís?"
              vacio={usables.length > 1 ? 'Elegí una cuenta' : undefined}
              opciones={usables.map((c) => ({ valor: c.id, texto: `${c.alias ?? `CBU …${c.cbuCvu.slice(-6)}`}${c.estado === 'pendiente' ? ' (se verifica con este pago)' : ''}` }))}
              value={cuentaElegida}
              onChange={(e) => setCuentaId(e.target.value)}
              ayuda="Tiene que ser desde una cuenta que cargaste. Si es otra, agregala en Cuentas."
            />
          )}

          {parametros.datosPago.alias ? (
            <div className={clases.datosPago}>
              <span>
                Transferí a
                <strong>{parametros.datosPago.alias}</strong>
                {parametros.datosPago.titular ? <span className={clases.secundario}>{parametros.datosPago.titular}{parametros.datosPago.banco ? ` · ${parametros.datosPago.banco}` : ''}</span> : null}
              </span>
              <Boton variante="secundario" onClick={() => void copiarAlias()} icono={copiado ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}>
                {copiado ? 'Copiado' : 'Copiar'}
              </Boton>
            </div>
          ) : (
            <Aviso tipo="info">Pedinos los datos para transferir por WhatsApp.</Aviso>
          )}

          <label className={clases.archivo}>
            <span>Comprobante de la transferencia (foto o PDF, hasta 10 MB)</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
          </label>
          <Boton type="submit" tamano="lg" anchoCompleto cargando={pedido.cargando} disabled={!listo}>
            Enviar pedido
          </Boton>
          {!listo ? <span className={clases.secundario}>Completá el monto, la cuenta y el comprobante.</span> : null}
        </form>
      ) : null}
    </PaginaJugador>
  );
}
