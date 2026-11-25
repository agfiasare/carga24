import { formatearPesos } from '@carga24/shared';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { portal } from '../../../api/portal';
import { useAccion } from '../../../api/useAccion';
import { useConsulta } from '../../../api/useConsulta';
import { leerPesos } from '../../../comun/formato';
import { Aviso, Boton, CampoFormulario, SelectorFormulario } from '../../../componentes';
import { PaginaJugador, plataformaElegida, SelectorPlataforma } from './comun';
import clases from './portal.module.css';

export function Retirar() {
  const navegar = useNavigate();
  const { datos: parametros } = useConsulta(portal.parametros, []);
  const { datos: cuentas } = useConsulta(portal.cuentas, []);
  const [montoTexto, setMontoTexto] = useState('');
  const [cuentaId, setCuentaId] = useState('');
  const pedido = useAccion(portal.pedir);
  const [plataformaId, setPlataformaId] = useState('');

  const monto = leerPesos(montoTexto);
  const verificadas = (cuentas ?? []).filter((c) => c.estado === 'verificada');
  const cuentaElegida = cuentaId || (verificadas.length === 1 ? verificadas[0]!.id : '');
  const bajo = monto && parametros ? monto < parametros.montos.retiroMinimo : false;
  const plataforma = plataformaElegida(parametros?.plataformas ?? [], plataformaId);
  const conAprobacion = monto && parametros ? monto >= parametros.montos.retiroConAprobacionDesde : false;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!monto) return;
    const resultado = await pedido.ejecutar({ tipo: 'retiro', monto, cuentaId: cuentaElegida, plataformaId: plataforma });
    if (resultado) navegar(`/pedidos/${resultado.valor.id}`, { replace: true });
  }

  return (
    <PaginaJugador titulo="Retirar" volver={{ a: '/inicio', texto: 'Inicio' }}>
      {parametros && cuentas ? (
        verificadas.length === 0 ? (
          <Aviso tipo="info">
            Los retiros van a una cuenta verificada: se verifica sola con tu primera carga desde esa cuenta. <Link to="/cuentas">Ver mis cuentas</Link>
          </Aviso>
        ) : (
          <form className={clases.formulario} onSubmit={enviar} noValidate>
            {pedido.error ? <Aviso tipo="error">{pedido.error.message}</Aviso> : null}
            <CampoFormulario
              etiqueta="¿Cuánto querés retirar?"
              inputMode="decimal"
              placeholder="$ 0"
              value={montoTexto}
              onChange={(e) => setMontoTexto(e.target.value)}
              ayuda={`Mínimo ${formatearPesos(parametros.montos.retiroMinimo)}`}
              error={montoTexto && !monto ? 'Escribí un monto válido, por ejemplo 20.000' : bajo ? 'Es menos que el mínimo' : undefined}
            />
            <SelectorPlataforma plataformas={parametros.plataformas} valor={plataformaId} alCambiar={setPlataformaId} tipo="retiro" />
            <SelectorFormulario
              etiqueta="¿A qué cuenta?"
              vacio={verificadas.length > 1 ? 'Elegí una cuenta' : undefined}
              opciones={verificadas.map((c) => ({ valor: c.id, texto: c.alias ?? `CBU …${c.cbuCvu.slice(-6)}` }))}
              value={cuentaElegida}
              onChange={(e) => setCuentaId(e.target.value)}
            />
            {conAprobacion ? <Aviso tipo="info">Por el monto, un supervisor tiene que aprobarlo. Puede tardar un poco más.</Aviso> : null}
            <p className={clases.secundario}>Lo descontamos de tu usuario en la plataforma y te lo transferimos.</p>
            <Boton type="submit" tamano="lg" anchoCompleto cargando={pedido.cargando} disabled={!monto || bajo || !cuentaElegida || !plataforma}>
              Pedir retiro
            </Boton>
          </form>
        )
      ) : null}
    </PaginaJugador>
  );
}
