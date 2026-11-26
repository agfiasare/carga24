import { Link } from 'react-router';
import { api } from '../../api/cliente';
import type { PromoPublica } from '../../api/promociones';
import { useConsulta } from '../../api/useConsulta';
import { useSesionJugador } from '../../sesion/sesion';
import { AntesAhora } from './AntesAhora';
import { ComoFunciona } from './ComoFunciona';
import { Cupon } from './Cupon';
import { Heroe } from './Heroe';
import { Preguntas } from './Preguntas';
import clases from './landing.module.css';

interface DatosLanding {
  horario: string;
  whatsapp: string;
  plataforma: string | null;
  promo: PromoPublica | null;
}

/** Página principal: explica el servicio y lleva a crear la cuenta. Cada sección vive en su archivo. */
export function Landing() {
  const { usuario } = useSesionJugador();
  const { datos } = useConsulta(() => api<DatosLanding>('GET', '/publico/landing'), []);
  const enlaceWhatsapp = datos?.whatsapp ? `https://wa.me/${datos.whatsapp}` : null;
  const destinoPrincipal = usuario ? '/inicio' : '/registro';

  return (
    <div className={clases.pagina}>
      <header className={clases.cabecera}>
        <img src="/marca/carga24-nombre-oro.png" alt="Carga24" className={clases.logoNombre} />
        <nav aria-label="Secciones" className={clases.secciones}>
          <a href="#como">Cómo funciona</a>
          <a href="#antes">Por qué Carga24</a>
          <a href="#preguntas">Preguntas</a>
        </nav>
        <div className={clases.accesos}>
          {usuario ? (
            <Link to="/inicio" className={clases.botonOro}>
              Ir a mi cuenta
            </Link>
          ) : (
            <>
              <Link to="/ingresar" className={clases.botonLinea}>
                Ingresar
              </Link>
              <Link to="/registro" className={clases.botonOro}>
                Crear cuenta
              </Link>
            </>
          )}
        </div>
      </header>

      <main>
        <Heroe horario={datos?.horario} conCuenta={Boolean(usuario)} destino={destinoPrincipal} enlaceWhatsapp={enlaceWhatsapp} />
        <AntesAhora />
        <ComoFunciona plataforma={datos?.plataforma ?? 'la plataforma'} destino={destinoPrincipal} />
        {datos?.promo ? <Cupon promo={datos.promo} destino={usuario ? '/cargar' : '/registro'} /> : null}
        <Preguntas />

        <section className={clases.cierre}>
          {/* Dos copias iguales: cuando la primera sale por la izquierda, la segunda ya ocupa su lugar. */}
          <div className={clases.marquesina} aria-hidden="true">
            <div className={clases.marquesinaPista}>
              {[0, 1].map((copia) => (
                <span key={copia} className={clases.marquesinaTexto}>
                  Cargá · Jugá · Cobrá · Cargá · Jugá · Cobrá ·&nbsp;
                </span>
              ))}
            </div>
          </div>
          <div className={`${clases.contenedor} ${clases.cierreContenido}`}>
            <span className={clases.cierreTexto}>Tu cuenta te espera. Pedí por donde quieras: lo encontrás todo acá.</span>
            <div className={clases.botones}>
              <Link to={destinoPrincipal} className={`${clases.botonOro} ${clases.mediano}`}>
                {usuario ? 'Ir a mi cuenta' : 'Crear mi cuenta'}
              </Link>
              {usuario ? null : (
                <Link to="/ingresar" className={`${clases.botonLinea} ${clases.mediano}`}>
                  Ya tengo cuenta
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className={clases.pie}>
        <div className={clases.contenedorPie}>
          <img src="/marca/carga24-nombre-oro.png" alt="Carga24" className={clases.logoPie} />
          <span className={clases.edad}>
            <span className={clases.mas18}>18+</span>Solo mayores de 18. Jugá con responsabilidad.
          </span>
          {enlaceWhatsapp ? (
            <a href={enlaceWhatsapp} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
