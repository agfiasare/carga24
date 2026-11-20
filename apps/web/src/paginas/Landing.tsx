import { ArrowRight, Check, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api/cliente';
import { textoVigencia, type PromoPublica } from '../api/promociones';
import { useConsulta } from '../api/useConsulta';
import { useSesionJugador } from '../sesion/sesion';
import clases from './Landing.module.css';

interface DatosLanding {
  horario: string;
  whatsapp: string;
  plataforma: string | null;
  promo: PromoPublica | null;
}

const PREGUNTAS: [string, string][] = [
  ['¿Cuánto tarda en acreditarse una carga?', 'Apenas vemos tu pago en nuestra cuenta, cargamos el saldo y te avisamos. El estado lo seguís desde la web en todo momento.'],
  ['¿Tengo que mandar comprobante?', 'No, si transferís desde una cuenta tuya que ya está verificada: lo vemos en el banco. La primera vez que pagás desde una cuenta nueva, sí: ese pago es el que la verifica.'],
  ['¿Cómo cobro un premio?', 'Pedí un retiro desde la web o por WhatsApp, elegí una de tus cuentas verificadas y te transferimos. El comprobante queda en tu historial.'],
  ['¿Qué datos me piden?', 'Solo tu usuario de la plataforma, tu teléfono y un nombre de usuario. No pedimos nombre real, email ni documento.'],
  ['¿Puedo seguir pidiendo por WhatsApp?', 'Sí. Lo que pidas por WhatsApp también aparece en tu cuenta, junto con todo lo demás.'],
];

/** Página principal (carga24.com.ar): explica el servicio y lleva a crear la cuenta. */
export function Landing() {
  const { usuario } = useSesionJugador();
  const { datos } = useConsulta(() => api<DatosLanding>('GET', '/publico/landing'), []);
  const [abierta, setAbierta] = useState(0);
  const enlaceWhatsapp = datos?.whatsapp ? `https://wa.me/${datos.whatsapp}` : null;
  const plataforma = datos?.plataforma ?? 'la plataforma';
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
        <section className={clases.heroe}>
          <div className={clases.resplandor} aria-hidden="true" />
          <div className={clases.heroeTexto}>
            {datos?.horario ? (
              <span className={clases.horario}>
                <span className={clases.punto} />
                Atención {datos.horario}
              </span>
            ) : null}
            <h1 className={clases.titulo}>
              Cargá saldo y cobrá tus premios, <span className={clases.oro}>sin vueltas.</span>
            </h1>
            <p className={clases.bajada}>Pedí por WhatsApp o desde la web y seguí cada carga y cada retiro en tu cuenta, con su estado en tiempo real.</p>
            <div className={clases.botones}>
              <Link to={destinoPrincipal} className={`${clases.botonOro} ${clases.grande}`}>
                {usuario ? 'Ir a mi cuenta' : 'Crear mi cuenta'}
                <ArrowRight size={20} aria-hidden="true" />
              </Link>
              {enlaceWhatsapp ? (
                <a href={enlaceWhatsapp} className={`${clases.botonLinea} ${clases.grande}`} target="_blank" rel="noreferrer">
                  <MessageCircle size={20} aria-hidden="true" className={clases.verde} />
                  Pedir por WhatsApp
                </a>
              ) : null}
            </div>
            <ul className={clases.garantias}>
              {['Cada pago verificado', 'Historial de todo', 'Retiros a tu cuenta'].map((g) => (
                <li key={g}>
                  <Check size={16} aria-hidden="true" className={clases.verde} />
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
                <strong className={clases.verde}>+$5.000</strong>
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

        <section id="antes" className={clases.antes}>
          <div className={clases.contenedor}>
            <h2 className={clases.tituloSeccion}>
              Se terminó el <span className={clases.resaltado}>“¿me cargaste?”</span>
            </h2>
            <div className={clases.comparacion}>
              <div className={clases.columna}>
                <span className={clases.rotuloAntes}>Antes · cinco chats, cero respaldo</span>
                <div className={clases.chat}>
                  {[
                    ['hola, me cargás 5 mil? ya te transferí', '21:02'],
                    ['??', '21:20'],
                    ['te mando el comprobante de nuevo', '21:43'],
                    ['me cargaron o no???', '22:15'],
                  ].map(([texto, hora]) => (
                    <div key={hora} className={clases.mensaje}>
                      <span>{texto}</span>
                      <small>{hora} ✓✓</small>
                    </div>
                  ))}
                  <span className={clases.escribiendo}>escribiendo… (hace 40 min)</span>
                </div>
              </div>
              <div className={clases.columna}>
                <span className={clases.rotuloAhora}>Ahora · todo en tu cuenta</span>
                <div className={clases.cuenta}>
                  <Fila titulo="Carga #1291" detalle="Hoy 21:02 · pagaste desde tu CVU ···0921" monto="$10.000" estado="Verificando" tono="ambar" />
                  <Fila titulo="Carga #1284" detalle="12 nov · acreditada por el equipo" monto="+$5.000" estado="Acreditada" tono="verde" />
                  <Fila titulo="Retiro #1270" detalle="10 nov · con comprobante" monto="−$12.000" estado="Pagado" tono="verde" />
                </div>
                <p className={clases.explicacion}>
                  Cada pedido tiene número, estado y responsable. Revisamos tu pago en nuestra cuenta antes de acreditar, y cada retiro queda con su comprobante. Si algo pasa, está escrito.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="como" className={clases.como}>
          <div className={`${clases.contenedor} ${clases.comoContenido}`}>
            <div className={clases.comoTexto}>
              <h2 className={clases.tituloSeccion}>
                Tres cartas.
                <br />
                <span className={clases.oro}>Mano ganada.</span>
              </h2>
              <p className={clases.bajada}>Sin papeles, sin datos personales y sin perseguir a nadie por WhatsApp.</p>
              <Link to={destinoPrincipal} className={`${clases.botonOro} ${clases.mediano}`}>
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

        {datos?.promo ? (
          <section className={clases.contenedor} aria-label="Promoción">
            <div className={clases.cupon}>
              <div className={clases.cuponCuerpo}>
                <span className={clases.cuponRotulo}>Cupón · {textoVigencia(datos.promo.hasta).toLowerCase()}</span>
                <span className={clases.cuponTitulo}>{datos.promo.titulo}</span>
                <span className={clases.cuponCondiciones}>{datos.promo.condiciones}</span>
              </div>
              <div className={clases.talon}>
                <span className={clases.muescaArriba} aria-hidden="true" />
                <span className={clases.muescaAbajo} aria-hidden="true" />
                <span className={clases.cuponCodigoRotulo}>Código</span>
                <span className={clases.cuponCodigo}>{datos.promo.codigo}</span>
                <Link to={usuario ? '/cargar' : '/registro'} className={clases.botonVerde}>
                  Usar el cupón
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        <section id="preguntas" className={clases.preguntas}>
          <div className={`${clases.contenedor} ${clases.preguntasContenido}`}>
            <h2 className={clases.tituloSeccion}>
              Lo que nos preguntan <span className={clases.oro}>todas las noches</span>
            </h2>
            <div className={clases.lista}>
              {PREGUNTAS.map(([pregunta, respuesta], i) => (
                <div key={pregunta} className={clases.pregunta}>
                  <button type="button" aria-expanded={abierta === i} aria-controls={`respuesta-${i}`} onClick={() => setAbierta(abierta === i ? -1 : i)}>
                    <span className={clases.numero}>0{i + 1}</span>
                    <span className={clases.textoPregunta}>{pregunta}</span>
                    <span className={`${clases.mas} ${abierta === i ? clases.masAbierto : ''}`} aria-hidden="true">
                      +
                    </span>
                  </button>
                  {abierta === i ? (
                    <p id={`respuesta-${i}`} className={clases.respuesta}>
                      {respuesta}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={clases.cierre}>
          <div className={clases.marquesina} aria-hidden="true">
            Cargá · Jugá · Cobrá · Cargá · Jugá · Cobrá · Cargá · Jugá · Cobrá
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

function Fila({ titulo, detalle, monto, estado, tono }: { titulo: string; detalle: string; monto: string; estado: string; tono: 'ambar' | 'verde' }) {
  return (
    <div className={clases.filaCuenta}>
      <span className={clases.filaTexto}>
        <strong>{titulo}</strong>
        <small>{detalle}</small>
      </span>
      <span className={`${clases.filaMonto} ${monto.startsWith('+') ? clases.verde : ''}`}>{monto}</span>
      <span className={tono === 'ambar' ? clases.pildoraAmbar : clases.pildoraVerde}>{estado}</span>
    </div>
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
