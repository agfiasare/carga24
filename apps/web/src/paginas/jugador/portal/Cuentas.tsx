import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { portal, type CuentaPropia } from '../../../api/portal';
import { useAccion } from '../../../api/useAccion';
import { useConsulta } from '../../../api/useConsulta';
import { Aviso, Boton, CampoFormulario, Etiqueta, ModalConfirmacion } from '../../../componentes';
import { PaginaJugador } from './comun';
import clases from './portal.module.css';

const ESTADO: Record<CuentaPropia['estado'], { texto: string; tono: 'ok' | 'aviso' | 'error' }> = {
  verificada: { texto: 'Verificada', tono: 'ok' },
  pendiente: { texto: 'Se verifica con tu primer pago', tono: 'aviso' },
  rechazada: { texto: 'Rechazada', tono: 'error' },
};

export function Cuentas() {
  const { datos: cuentas, error, recargar } = useConsulta(portal.cuentas, []);
  const [agregando, setAgregando] = useState(false);
  const [quitar, setQuitar] = useState<CuentaPropia | null>(null);
  const quitado = useAccion((id: string) => portal.quitarCuenta(id));

  async function confirmarQuitar() {
    if (!quitar) return;
    const resultado = await quitado.ejecutar(quitar.id);
    setQuitar(null);
    if (resultado) recargar();
  }

  return (
    <PaginaJugador titulo="Tus cuentas">
      <p className={clases.secundario}>
        Las cuentas desde las que transferís y a las que te enviamos los retiros. Pueden ser tuyas o de otra persona. Cada una se verifica con el primer pago que hagas desde ella.
      </p>
      {error ? <Aviso tipo="error">{error.message}</Aviso> : null}
      {quitado.error ? <Aviso tipo="error">{quitado.error.message}</Aviso> : null}
      <div className={clases.lista}>
        {cuentas?.map((c) => (
          <div key={c.id} className={clases.tarjeta}>
            <div className={clases.cuenta}>
              <span>
                <strong>{c.alias ?? 'Sin alias'}</strong>
                <br />
                <code>{c.cbuCvu}</code>
                {c.banco || c.titular ? <span className={clases.secundario}><br />{[c.banco, c.titular].filter(Boolean).join(' · ')}</span> : null}
              </span>
              <Etiqueta tono={ESTADO[c.estado].tono}>{ESTADO[c.estado].texto}</Etiqueta>
            </div>
            {c.estado !== 'verificada' ? (
              <div className={clases.enlaces}>
                <button type="button" onClick={() => setQuitar(c)}>
                  Quitar
                </button>
              </div>
            ) : null}
          </div>
        ))}
        {cuentas && cuentas.length === 0 ? <p className={clases.vacio}>Todavía no cargaste ninguna cuenta.</p> : null}
      </div>
      {agregando ? (
        <NuevaCuenta
          alCerrar={() => setAgregando(false)}
          alGuardar={() => {
            setAgregando(false);
            recargar();
          }}
        />
      ) : (
        <Boton variante="secundario" icono={<Plus size={18} aria-hidden="true" />} onClick={() => setAgregando(true)}>
          Agregar cuenta
        </Boton>
      )}
      {quitar ? (
        <ModalConfirmacion titulo="Quitar cuenta" textoConfirmar="Quitar" variante="peligro" cargando={quitado.cargando} alConfirmar={() => void confirmarQuitar()} alCerrar={() => setQuitar(null)}>
          <p>¿Quitás la cuenta {quitar.alias ?? quitar.cbuCvu}?</p>
        </ModalConfirmacion>
      ) : null}
    </PaginaJugador>
  );
}

function NuevaCuenta({ alCerrar, alGuardar }: { alCerrar: () => void; alGuardar: () => void }) {
  const [datos, setDatos] = useState({ cbuCvu: '', alias: '', banco: '', titular: '' });
  const guardado = useAccion(portal.agregarCuenta);
  const cambiar = (campo: keyof typeof datos) => (e: { target: { value: string } }) => setDatos({ ...datos, [campo]: e.target.value });

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const resultado = await guardado.ejecutar({
      cbuCvu: datos.cbuCvu,
      ...(datos.alias.trim() ? { alias: datos.alias } : {}),
      ...(datos.banco.trim() ? { banco: datos.banco } : {}),
      ...(datos.titular.trim() ? { titular: datos.titular } : {}),
    });
    if (resultado) alGuardar();
  }

  const error = guardado.error;
  return (
    <form className={`${clases.tarjeta} ${clases.formulario}`} onSubmit={enviar} noValidate aria-labelledby="titulo-nueva-cuenta">
      <h2 id="titulo-nueva-cuenta">Nueva cuenta</h2>
      {error && error.errores.length === 0 ? <Aviso tipo="error">{error.message}</Aviso> : null}
      <CampoFormulario etiqueta="CBU o CVU" inputMode="numeric" ayuda="22 números" value={datos.cbuCvu} onChange={cambiar('cbuCvu')} error={error?.delCampo('cbuCvu')} />
      <CampoFormulario etiqueta="Alias (opcional)" value={datos.alias} onChange={cambiar('alias')} error={error?.delCampo('alias')} autoCapitalize="none" />
      <CampoFormulario etiqueta="Banco o billetera (opcional)" value={datos.banco} onChange={cambiar('banco')} />
      <CampoFormulario etiqueta="Titular (opcional)" ayuda="Puede no ser tuya." value={datos.titular} onChange={cambiar('titular')} />
      <div className={clases.acciones}>
        <Boton variante="secundario" onClick={alCerrar}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={guardado.cargando} disabled={!datos.cbuCvu.trim()}>
          Guardar
        </Boton>
      </div>
    </form>
  );
}
