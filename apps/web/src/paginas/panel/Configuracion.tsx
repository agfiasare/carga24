import { calcularCarga, formatearPesos } from '@carga24/shared';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
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

export function Configuracion() {
  const { tiene } = usePermisos();
  const { datos, error, setDatos } = useConsulta(administracion.configuracion, []);
  return (
    <PaginaPanel titulo="Configuración" requiere={['configuracion.editar', 'plataformas.gestionar']}>
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      {datos && tiene('configuracion.editar') ? <Formulario config={datos} alGuardar={setDatos} /> : null}
      {tiene('plataformas.gestionar') ? <Plataformas /> : null}
    </PaginaPanel>
  );
}

function Formulario({ config, alGuardar }: { config: Config; alGuardar: (c: Config) => void }) {
  const [modo, setModo] = useState(config.comision.modo);
  const [pct, setPct] = useState(porcentaje(config.comision.porcentajePb));
  const [montos, setMontos] = useState({
    cargaMinima: pesos(config.montos.cargaMinima),
    cargaMaxima: pesos(config.montos.cargaMaxima),
    retiroMinimo: pesos(config.montos.retiroMinimo),
    retiroConAprobacionDesde: pesos(config.montos.retiroConAprobacionDesde),
  });
  const [pendientes, setPendientes] = useState(String(config.cuentasPendientesMaximas));
  const [pago, setPago] = useState(config.pago);
  const [horario, setHorario] = useState(config.horario);
  const [confirmar, setConfirmar] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const guardar = useAccion(administracion.guardarConfiguracion);

  const pb = leerPorcentaje(pct);
  const montosLeidos = Object.fromEntries(Object.entries(montos).map(([k, v]) => [k, leerPesos(v)])) as Record<keyof typeof montos, number | null>;
  const cantidadPendientes = Number(pendientes);
  const invalido = pb === null || Object.values(montosLeidos).some((v) => v === null) || !Number.isInteger(cantidadPendientes) || cantidadPendientes < 1 || cantidadPendientes > 10;
  const cambiaComision = pb !== config.comision.porcentajePb || modo !== config.comision.modo;
  const ejemplo = pb !== null ? calcularCarga(1_000_000, pb, modo) : null;

  async function enviar() {
    if (invalido) return;
    const resultado = await guardar.ejecutar({
      comision: { modo, porcentajePb: pb! },
      montos: montosLeidos as Config['montos'],
      cuentasPendientesMaximas: cantidadPendientes,
      pago,
      horario,
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
    <form className={clases.pila} onSubmit={alEnviar} noValidate>
      {guardar.error ? <Aviso tipo="error">{guardar.error.message}</Aviso> : null}
      {guardado ? <Aviso tipo="ok">Configuración guardada. Los pedidos nuevos ya usan estos valores.</Aviso> : null}

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
        </div>
        {ejemplo ? (
          <p className={clases.explicacion}>
            Ejemplo con {formatearPesos(1_000_000)}: transfiere <strong>{formatearPesos(ejemplo.pagado)}</strong>, se acreditan <strong>{formatearPesos(ejemplo.acreditado)}</strong>, ganancia{' '}
            {formatearPesos(ejemplo.ganancia)}.
          </p>
        ) : null}
      </section>

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

      <section className={clases.tarjeta} aria-labelledby="t-pago">
        <h2 id="t-pago">Datos para transferir</h2>
        <p className={clases.explicacion}>Los ve el jugador al pedir una carga.</p>
        <div className={clases.dosCampos}>
          <CampoFormulario etiqueta="Alias o CBU" value={pago.alias} onChange={(e) => setPago({ ...pago, alias: e.target.value })} />
          <CampoFormulario etiqueta="Titular" value={pago.titular} onChange={(e) => setPago({ ...pago, titular: e.target.value })} />
          <CampoFormulario etiqueta="Banco" value={pago.banco} onChange={(e) => setPago({ ...pago, banco: e.target.value })} />
          <CampoFormulario etiqueta="Horario de atención" value={horario} onChange={(e) => setHorario(e.target.value)} placeholder="Todos los días de 10 a 2" />
        </div>
      </section>

      <div className={clases.barra}>
        <Boton type="submit" tamano="lg" cargando={guardar.cargando} disabled={invalido}>
          Guardar configuración
        </Boton>
        {config.actualizadoEn ? (
          <span className={clases.total}>
            Último cambio: {formatearFecha(config.actualizadoEn)} {formatearHora(config.actualizadoEn)}
          </span>
        ) : null}
      </div>
      {confirmar ? (
        <ModalConfirmacion titulo="¿Cambiás la comisión?" textoConfirmar="Sí, cambiar" cargando={guardar.cargando} alConfirmar={() => void enviar()} alCerrar={() => setConfirmar(false)}>
          <p>
            Pasa de {porcentaje(config.comision.porcentajePb)} % ({config.comision.modo}) a <strong>{pct} % ({modo})</strong>. Aplica a los pedidos nuevos desde ahora; los anteriores no cambian.
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
