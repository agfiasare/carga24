import { ArrowRight, Check, MessageCircle } from 'lucide-react';
import { Link } from 'react-router';
import base from './landing.module.css';
import clases from './heroe.module.css';

interface HeroeProps {
  horario?: string;
  conCuenta: boolean;
  destino: string;
  enlaceWhatsapp: string | null;
}

/** Primera vista: la promesa, los dos caminos (cuenta o WhatsApp) y un celular de muestra. */
export function Heroe({ horario, conCuenta, destino, enlaceWhatsapp }: HeroeProps) {
  return (
    <section className={clases.heroe}>
      <div className={clases.resplandor} aria-hidden="true" />
      <div className={clases.heroeTexto}>
        {horario ? (
          <span className={clases.horario}>
            <span className={clases.punto} />
            Atención {horario}
          </span>
        ) : null}
        <h1 className={base.titulo}>
          Cargá saldo y cobrá tus premios, <span className={base.oro}>sin vueltas.</span>
        </h1>
        <p className={base.bajada}>Pedí por WhatsApp o desde la web y seguí cada carga y cada retiro en tu cuenta, con su estado en tiempo real.</p>
        <div className={base.botones}>
          <Link to={destino} className={`${base.botonOro} ${base.grande}`}>
            {conCuenta ? 'Ir a mi cuenta' : 'Crear mi cuenta'}
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
          {enlaceWhatsapp ? (
            <a href={enlaceWhatsapp} className={`${base.botonLinea} ${base.grande}`} target="_blank" rel="noreferrer">
              <MessageCircle size={20} aria-hidden="true" className={base.verde} />
              Pedir por WhatsApp
            </a>
          ) : null}
        </div>
        <ul className={clases.garantias}>
          {['Cada pago verificado', 'Historial de todo', 'Retiros a tu cuenta'].map((g) => (
            <li key={g}>
              <Check size={16} aria-hidden="true" className={base.verde} />
              {g}
            </li>
          ))}
        </ul>
      </div>
      <div className={clases.ilustracion} aria-hidden="true">
        <img src="/marca/carga24-logo-oro.png" alt="" className={clases.ficha} />
        <div className={clases.telefono}>
          <img src="/marca/carga24-nombre-oro.png" alt="" className={clases.telefonoLogo} />
          <span className={clases.chico}>Hola, juanperez</span>
          <div className={clases.pedirCarga}>
            <span>Pedir carga</span>
            <strong>$10.000</strong>
          </div>
          <div className={clases.enCurso}>
            <div className={clases.fila}>
              <span>Carga #1291</span>
              <span className={clases.ambar}>Verificando</span>
            </div>
            <div className={clases.progreso}>
              <span className={clases.lleno} />
              <span className={clases.lleno} />
              <span />
            </div>
          </div>
          <div className={clases.movimiento}>
            <span className={clases.iconoVerde}>↑</span>
            <span>Carga acreditada</span>
            <strong className={base.verde}>+$5.000</strong>
          </div>
          <div className={clases.movimiento}>
            <span className={clases.iconoGris}>↓</span>
            <span>Retiro pagado</span>
            <strong>−$12.000</strong>
          </div>
        </div>
        <div className={clases.aviso}>
          <span className={clases.avisoIcono}>
            <Check size={18} />
          </span>
          <span>
            <strong>Carga acreditada</strong>
            <small>Te avisamos al instante</small>
          </span>
        </div>
      </div>
    </section>
  );
}
