import { calcularCarga, formatearPesos } from '@carga24/shared';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { administracion, type Configuracion as Config, type Plataforma } from '../../api/administracion';
import { useAccion } from '../../api/useAccion';
import { useConsulta } from '../../api/useConsulta';
import { formatearFecha, formatearHora, leerPesos } from '../../comun/formato';
import { Aviso, Boton, CampoFormulario, Etiqueta, ModalConfirmacion, SelectorFormulario } from '../../componentes';
import { PaginaPanel, usePermisos } from './PaginaPanel';
import clases from './panel.module.css';

const pesos = (centavos: number) => (centavos / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 });
const porcentaje = (pb: number) => (pb / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 });
const leerPorcentaje = (texto: string): number | null => {
  const n = Number(texto.replace(',', '.'));
  return texto.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 50 ? Math.round(n * 100) : null;
};

type Seccion = 'comisiones' | 'montos' | 'atencion' | 'plataformas';

const SECCIONES: { clave: Seccion; texto: string; permiso: 'configuracion.editar' | 'plataformas.gestionar' }[] = [
  { clave: 'comisiones', texto: 'Comisiones', permiso: 'configuracion.editar' },
  { clave: 'montos', texto: 'Montos y cuentas', permiso: 'configuracion.editar' },
  { clave: 'atencion', texto: 'Pagos y atención', permiso: 'configuracion.editar' },
  { clave: 'plataformas', texto: 'Plataformas', permiso: 'plataformas.gestionar' },
];

/** Configuración en submenús; la sección elegida queda en la dirección (?seccion=…). */
export function Configuracion() {
  const { tiene } = usePermisos();
  const { datos, error, setDatos } = useConsulta(administracion.configuracion, []);
  const [parametros, setParametros] = useSearchParams();
  const visibles = SECCIONES.filter((s) => tiene(s.permiso));
  const seccion = (visibles.find((s) => s.clave === parametros.get('seccion')) ?? visibles[0])?.clave;
  return (
    <PaginaPanel titulo="Configuración" requiere={['configuracion.editar', 'plataformas.gestionar']}>
      <nav className={clases.pestanas} aria-label="Secciones de la configuración">
        {visibles.map((s) => (
          <button key={s.clave} type="button" className={clases.pestana} aria-current={s.clave === seccion ? 'page' : undefined} onClick={() => setParametros({ seccion: s.clave }, { replace: true })}>
            {s.texto}
          </button>
        ))}
      </nav>
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      {/* El formulario queda montado entre pestañas: lo escrito no se pierde al cambiar. */}
      {datos && tiene('configuracion.editar') ? <Formulario config={datos} alGuardar={setDatos} seccion={seccion} /> : null}
      {seccion === 'plataformas' ? <Plataformas /> : null}
    </PaginaPanel>
  );
}

function Formulario({ config, alGuardar, seccion }: { config: Config; alGuardar: (c: Config) => void; seccion: Seccion | undefined }) {
  const [modo, setModo] = useState(config.comision.modo);
  const [pct, setPct] = useState(porcentaje(config.comision.porcentajePb));
  const [impuesto, setImpuesto] = useState(porcentaje(config.comision.impuestoPb ?? 0));
  const [montos, setMontos] = useState({
    cargaMinima: pesos(config.montos.cargaMinima),
    cargaMaxima: pesos(config.montos.cargaMaxima),
    retiroMinimo: pesos(config.montos.retiroMinimo),
    retiroConAprobacionDesde: pesos(config.montos.retiroConAprobacionDesde),
  });
  const [pendientes, setPendientes] = useState(String(config.cuentasPendientesMaximas));
  const [retiroPct, setRetiroPct] = useState(porcentaje(config.retiro?.comisionPb ?? 0));
  const [retiroDias, setRetiroDias] = useState(String(config.retiro?.diasSinCarga ?? 0));
  const [pago, setPago] = useState(config.pago);
  const [horario, setHorario] = useState(config.horario);
  const [whatsapp, setWhatsapp] = useState(config.whatsapp ?? '');
  const [confirmar, setConfirmar] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const guardar = useAccion(administracion.guardarConfiguracion);

  const pb = leerPorcentaje(pct);
  const impuestoPb = leerPorcentaje(impuesto);
  const retiroPb = leerPorcentaje(retiroPct);
  const diasSinCarga = Number(retiroDias);
  const diasInvalidos = !Number.isInteger(diasSinCarga) || diasSinCarga < 0 || diasSinCarga > 365;
  const montosLeidos = Object.fromEntries(Object.entries(montos).map(([k, v]) => [k, leerPesos(v)])) as Record<keyof typeof montos, number | null>;
  const cantidadPendientes = Number(pendientes);
  const invalido = pb === null || impuestoPb === null || retiroPb === null || diasInvalidos || Object.values(montosLeidos).some((v) => v === null) || !Number.isInteger(cantidadPendientes) || cantidadPendientes < 1 || cantidadPendientes > 10;
  const cambiaComision = pb !== config.comision.porcentajePb || modo !== config.comision.modo || impuestoPb !== (config.comision.impuestoPb ?? 0);
  const ejemplo = pb !== null && impuestoPb !== null ? calcularCarga(1_000_000, pb, modo, impuestoPb) : null;

  async function enviar() {
    if (invalido) return;
    const resultado = await guardar.ejecutar({
      comision: { modo, porcentajePb: pb!, impuestoPb: impuestoPb! },
      montos: montosLeidos as Config['montos'],
      cuentasPendientesMaximas: cantidadPendientes,
      retiro: { comisionPb: retiroPb!, diasSinCarga },
      pago,
      horario,
      whatsapp: whatsapp.replace(/\D/g, ''),
    });
    setConfirmar(false);
    if (resultado) {
      setGuardado(true);
      alGuardar(resultado.valor);
    }
  }

  function alEnviar(evento: FormEvent) {
    evento.preventDefault();
    setGuardado(false);
    if (cambiaComision) setConfirmar(true);
    else void enviar();
  }

  const campoMonto = (clave: keyof typeof montos, etiqueta: string, ayuda?: string) => (
    <CampoFormulario
      etiqueta={etiqueta}
      inputMode="decimal"
      value={montos[clave]}
      onChange={(e) => setMontos({ ...montos, [clave]: e.target.value })}
      ayuda={ayuda}
      error={montosLeidos[clave] === null ? 'Monto inválido' : undefined}
    />
  );

  return (
    <form className={clases.pila} onSubmit={alEnviar} noValidate hidden={seccion === 'plataformas'}>
      {guardar.error ? <Aviso tipo="error">{guardar.error.message}</Aviso> : null}
      {guardado ? <Aviso tipo="ok">Configuración guardada. Los pedidos nuevos ya usan estos valores.</Aviso> : null}

      {seccion === 'comisiones' ? (
        <>
      <section className={clases.tarjeta} aria-labelledby="t-comision">
        <h2 id="t-comision">Comisión a jugadores</h2>
        <p className={clases.explicacion}>Cambiarla no modifica los pedidos ya creados: cada uno guarda la comisión con la que se calculó.</p>
        <div className={clases.dosCampos}>
          <SelectorFormulario
            etiqueta="Modo"
            opciones={[
              { valor: 'recargo', texto: 'Recargo: el jugador paga el monto + la comisión' },
              { valor: 'descuento', texto: 'Descuento: se le acredita el monto − la comisión' },
            ]}
            value={modo}
            onChange={(e) => setModo(e.target.value as Config['comision']['modo'])}
          />
          <CampoFormulario etiqueta="Porcentaje" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} error={pb === null ? 'Entre 0 y 50' : undefined} />
          <CampoFormulario
            etiqueta="Impuesto de la plataforma (%)"
            ayuda="El que retiene la plataforma (por ejemplo, ley 27.346: 2,5). La ganancia es el porcentaje de arriba sobre lo transferido menos este impuesto."
            inputMode="decimal"
            value={impuesto}
            onChange={(e) => setImpuesto(e.target.value)}
            error={impuestoPb === null ? 'Entre 0 y 50' : undefined}
          />
        </div>
        {ejemplo ? (
          <p className={clases.explicacion}>
            Ejemplo con {formatearPesos(1_000_000)}: transfiere <strong>{formatearPesos(ejemplo.pagado)}</strong>, se acreditan <strong>{formatearPesos(ejemplo.acreditado)}</strong>
            {ejemplo.impuesto > 0 ? `, impuesto ${formatearPesos(ejemplo.impuesto)}` : ''}, ganancia <strong>{formatearPesos(ejemplo.ganancia)}</strong>.
          </p>
        ) : null}
      </section>

      <section className={clases.tarjeta} aria-labelledby="t-retiro">
        <h2 id="t-retiro">Comisión de retiro</h2>
        <p className={clases.explicacion}>Se cobra a quien pide un retiro sin haber cargado con ustedes y se descuenta de lo que se le transfiere. Con 0 % no se cobra.</p>
        <div className={clases.dosCampos}>
          <CampoFormulario etiqueta="Porcentaje de retiro" inputMode="decimal" value={retiroPct} onChange={(e) => setRetiroPct(e.target.value)} error={retiroPb === null ? 'Entre 0 y 50' : undefined} />
          <CampoFormulario
            etiqueta="Sin cargas en los últimos (días)"
            ayuda="0 = solo si nunca cargó con ustedes."
            inputMode="numeric"
            value={retiroDias}
            onChange={(e) => setRetiroDias(e.target.value)}
            error={diasInvalidos ? 'Entre 0 y 365' : undefined}
          />
        </div>
        {retiroPb ? (
          <p className={clases.explicacion}>
            Ejemplo: pide {formatearPesos(1_000_000)}, se le transfieren <strong>{formatearPesos(1_000_000 - Math.round((1_000_000 * retiroPb) / 10_000))}</strong>.
          </p>
        ) : null}
      </section>

        </>
      ) : null}

      {seccion === 'montos' ? (
      <section className={clases.tarjeta} aria-labelledby="t-montos">
        <h2 id="t-montos">Montos (en pesos)</h2>
        <div className={clases.dosCampos}>
          {campoMonto('cargaMinima', 'Carga mínima')}
          {campoMonto('cargaMaxima', 'Carga máxima')}
          {campoMonto('retiroMinimo', 'Retiro mínimo')}
          {campoMonto('retiroConAprobacionDesde', 'Retiros con aprobación desde', 'Desde este monto, un supervisor tiene que aprobarlo.')}
          <CampoFormulario
            etiqueta="Cuentas sin verificar por jugador"
            inputMode="numeric"
            value={pendientes}
            onChange={(e) => setPendientes(e.target.value)}
            error={invalido && (cantidadPendientes < 1 || cantidadPendientes > 10 || !Number.isInteger(cantidadPendientes)) ? 'Entre 1 y 10' : undefined}
          />
        </div>
      </section>

      ) : null}

      {seccion === 'atencion' ? (
      <section className={clases.tarjeta} aria-labelledby="t-pago">
        <h2 id="t-pago">Datos para transferir y atención</h2>
        <p className={clases.explicacion}>Los ve el jugador al pedir una carga y en la landing.</p>
        <div className={clases.dosCampos}>
          <CampoFormulario etiqueta="Alias o CBU" value={pago.alias} onChange={(e) => setPago({ ...pago, alias: e.target.value })} />
          <CampoFormulario etiqueta="Titular" value={pago.titular} onChange={(e) => setPago({ ...pago, titular: e.target.value })} />
          <CampoFormulario etiqueta="Banco" value={pago.banco} onChange={(e) => setPago({ ...pago, banco: e.target.value })} />
          <CampoFormulario etiqueta="Horario de atención" value={horario} onChange={(e) => setHorario(e.target.value)} placeholder="Todos los días de 10 a 2" />
          <CampoFormulario
            etiqueta="WhatsApp de atención"
            inputMode="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="5491155550000"
            ayuda="Con código de país, solo números. Lo usa el botón de la landing."
            error={guardar.error?.delCampo('whatsapp')}
          />
        </div>
      </section>

      ) : null}

      <div className={clases.acciones}>
        {config.actualizadoEn ? (
          <span className={clases.total}>
            Último cambio: {formatearFecha(config.actualizadoEn)} {formatearHora(config.actualizadoEn)}
          </span>
        ) : null}
        <Boton type="submit" tamano="lg" cargando={guardar.cargando} disabled={invalido}>
          Guardar configuración
        </Boton>
      </div>
      {confirmar ? (
        <ModalConfirmacion titulo="¿Cambiás la comisión?" textoConfirmar="Sí, cambiar" cargando={guardar.cargando} alConfirmar={() => void enviar()} alCerrar={() => setConfirmar(false)}>
          <p>
            Pasa de {porcentaje(config.comision.porcentajePb)} % ({config.comision.modo}, impuesto {porcentaje(config.comision.impuestoPb ?? 0)} %) a{' '}
            <strong>
              {pct} % ({modo}, impuesto {impuesto} %)
            </strong>
            . Aplica a los pedidos nuevos desde ahora; los anteriores no cambian.
          </p>
        </ModalConfirmacion>
      ) : null}
    </form>
  );
}

function Plataformas() {
  const { datos, error, recargar } = useConsulta(administracion.plataformas, []);
  const [nombre, setNombre] = useState('');
  const alta = useAccion(administracion.crearPlataforma);
  const cambio = useAccion(administracion.editarPlataforma);
  const [desactivar, setDesactivar] = useState<Plataforma | null>(null);

  async function crear(evento: FormEvent) {
    evento.preventDefault();
    if (await alta.ejecutar(nombre)) {
      setNombre('');
      recargar();
    }
  }

  async function cambiarEstado(p: Plataforma) {
    const resultado = await cambio.ejecutar(p.id, { activa: !p.activa });
    setDesactivar(null);
    if (resultado) recargar();
  }

  const fallo = error ?? alta.error ?? cambio.error;
  return (
    <section className={clases.tarjeta} aria-labelledby="t-plataformas">
      <h2 id="t-plataformas">Plataformas</h2>
      <p className={clases.explicacion}>Donde se carga el saldo. Siempre tiene que quedar al menos una activa.</p>
      {fallo ? <Aviso tipo="error">{fallo.message}</Aviso> : null}
      {datos?.map((p) => (
        <div key={p.id} className={clases.accion}>
          <p>
            <strong>{p.nombre}</strong>
            {p._count.pedidos} pedidos
          </p>
          <span className={clases.filaBotones}>
            {p.activa ? <Etiqueta tono="ok">Activa</Etiqueta> : <Etiqueta>Inactiva</Etiqueta>}
            <Boton variante="secundario" onClick={() => (p.activa ? setDesactivar(p) : void cambiarEstado(p))}>
              {p.activa ? 'Desactivar' : 'Activar'}
            </Boton>
          </span>
        </div>
      ))}
      <form className={clases.filaBotones} onSubmit={crear} noValidate>
        <CampoFormulario etiqueta="Nueva plataforma" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Boton type="submit" variante="secundario" icono={<Plus size={18} aria-hidden="true" />} cargando={alta.cargando} disabled={nombre.trim().length < 2}>
          Agregar
        </Boton>
      </form>
      {desactivar ? (
        <ModalConfirmacion titulo={`Desactivar ${desactivar.nombre}`} textoConfirmar="Desactivar" variante="peligro" cargando={cambio.cargando} alConfirmar={() => void cambiarEstado(desactivar)} alCerrar={() => setDesactivar(null)}>
          <p>No se van a poder registrar pedidos nuevos en esta plataforma. Los existentes no cambian.</p>
        </ModalConfirmacion>
      ) : null}
    </section>
  );
}
