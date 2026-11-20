import { Pin } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { authJugador } from '../../../api/auth';
import { ESTADOS_ABIERTOS, portal } from '../../../api/portal';
import { promociones, textoVigencia } from '../../../api/promociones';
import { useConsulta } from '../../../api/useConsulta';
import { CuponPromo, Monto } from '../../../componentes';
import { usePortalEnVivo } from '../../../sesion/portalEnVivo';
import { useSesionJugador } from '../../../sesion/sesion';
import { explicarEstado, FilaPedido, PaginaJugador, PasosPedido } from './comun';
import clases from './portal.module.css';

export function Inicio() {
  const { usuario, establecer } = useSesionJugador();
  const { version } = usePortalEnVivo();
  const navegar = useNavigate();
  const { datos: recientes } = useConsulta(() => portal.pedidos({ pagina: 1 }), [version]);
  const { datos: novedades } = useConsulta(portal.novedades, []);
  const { datos: promos } = useConsulta(() => promociones.vigentes('inicio'), []);
  const enCurso = recientes?.pedidos.find((p) => ESTADOS_ABIERTOS.includes(p.estado));
  const fijada = novedades?.find((n) => n.fijada);

  async function salir() {
    await authJugador.salir().catch(() => undefined);
    establecer(null);
    navegar('/ingresar', { replace: true });
  }

  return (
    <PaginaJugador titulo={`Hola${usuario?.nombreUsuario ? `, ${usuario.nombreUsuario}` : ''}`}>
      {enCurso ? (
        <Link to={`/pedidos/${enCurso.id}`} className={`${clases.tarjeta} ${clases.destacada}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className={clases.secundario}>
            {enCurso.tipo === 'carga' ? 'Carga' : 'Retiro'} #{enCurso.id} en curso
          </span>
          <Monto centavos={enCurso.monto} tamano="lg" destacado />
          <PasosPedido pedido={enCurso} />
          <span className={clases.secundario}>{explicarEstado(enCurso)}</span>
        </Link>
      ) : (
        <div className={clases.acciones}>
          <Link to="/cargar" className={`${clases.botonGrande} ${clases.cargar}`}>
            Cargar
            <small>Saldo en tu usuario</small>
          </Link>
          <Link to="/retirar" className={`${clases.botonGrande} ${clases.retirar}`}>
            Retirar
            <small>A tu cuenta</small>
          </Link>
        </div>
      )}

      {promos && promos.length > 0 ? (
        <section className={clases.cupones} aria-label="Promociones">
          {promos.map((p) => (
            <CuponPromo key={p.id} titulo={p.titulo} condiciones={p.condiciones} codigo={p.codigo} vigencia={textoVigencia(p.hasta)} />
          ))}
        </section>
      ) : null}

      {fijada ? (
        <section className={clases.tarjeta} aria-labelledby="novedad-fijada">
          <span className={clases.secundario}>
            <Pin size={14} aria-hidden="true" /> Novedad
          </span>
          <h2 id="novedad-fijada">{fijada.titulo}</h2>
          <p className={clases.novedad}>{fijada.texto}</p>
        </section>
      ) : null}

      {recientes && recientes.pedidos.length > 0 ? (
        <section aria-labelledby="ultimos" className={clases.lista}>
          <h2 id="ultimos" className={clases.secundario}>
            Últimos pedidos
          </h2>
          {recientes.pedidos.slice(0, 3).map((p) => (
            <FilaPedido key={p.id} pedido={p} />
          ))}
          <Link to="/historial" className={clases.secundario}>
            Ver todos →
          </Link>
        </section>
      ) : null}

      <div className={clases.enlaces}>
        <Link to="/cambiar-contrasena">Cambiar contraseña</Link>
        <button type="button" onClick={() => void salir()}>
          Salir
        </button>
      </div>
    </PaginaJugador>
  );
}
