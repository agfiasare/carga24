import { Link } from 'react-router';
import base from './landing.module.css';
import clases from './como.module.css';

/** "Cómo funciona" en tres cartas. */
export function ComoFunciona({ plataforma, destino }: { plataforma: string; destino: string }) {
  return (
    <section id="como" className={clases.como}>
      <div className={`${base.contenedor} ${clases.comoContenido}`}>
        <div className={clases.comoTexto}>
          <h2 className={`${base.tituloSeccion} ${clases.titulo}`}>
            Tres cartas.
            <br />
            <span className={base.oro}>Mano ganada.</span>
          </h2>
          <p className={base.bajada}>Sin papeles, sin datos personales y sin perseguir a nadie por WhatsApp.</p>
          <Link to={destino} className={`${base.botonOro} ${base.mediano} ${clases.boton}`}>
            Repartir mis cartas
          </Link>
        </div>
        <ol className={clases.cartas}>
          <Carta numero="1" palo="♠" titulo="Creá tu cuenta" texto={`Tu usuario de ${plataforma}, tu teléfono y un nombre de usuario. Nada más.`} />
          <Carta numero="2" palo="♥" rojo titulo="Pedí y transferí" texto="Desde una cuenta ya verificada no mandás comprobante: lo vemos en el banco." />
          <Carta numero="3" palo="♦" rojo titulo="A jugar" texto="Cargamos tu saldo y te avisamos. Queda todo en tu historial." />
        </ol>
      </div>
    </section>
  );
}

function Carta({ numero, palo, titulo, texto, rojo = false }: { numero: string; palo: string; titulo: string; texto: string; rojo?: boolean }) {
  return (
    <li className={clases.carta}>
      <span className={`${clases.indice} ${rojo ? clases.rojo : ''}`} aria-hidden="true">
        {numero}
        <small>{palo}</small>
      </span>
      <span className={`${clases.indice} ${clases.indiceAbajo} ${rojo ? clases.rojo : ''}`} aria-hidden="true">
        {numero}
        <small>{palo}</small>
      </span>
      <span className={clases.cartaTitulo}>{titulo}</span>
      <span className={clases.cartaTexto}>{texto}</span>
    </li>
  );
}
