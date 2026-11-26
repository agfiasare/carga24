import { useState } from 'react';
import base from './landing.module.css';
import clases from './preguntas.module.css';

const PREGUNTAS: [string, string][] = [
  ['¿Cuánto tarda en acreditarse una carga?', 'Apenas vemos tu pago en nuestra cuenta, cargamos el saldo y te avisamos. El estado lo seguís desde la web en todo momento.'],
  ['¿Tengo que mandar comprobante?', 'No, si transferís desde una cuenta tuya que ya está verificada: lo vemos en el banco. La primera vez que pagás desde una cuenta nueva, sí: ese pago es el que la verifica.'],
  ['¿Cómo cobro un premio?', 'Pedí un retiro desde la web o por WhatsApp, elegí una de tus cuentas verificadas y te transferimos. El comprobante queda en tu historial.'],
  ['¿Qué datos me piden?', 'Solo tu usuario de la plataforma, tu teléfono y un nombre de usuario. No pedimos nombre real, email ni documento.'],
  ['¿Puedo seguir pidiendo por WhatsApp?', 'Sí. Lo que pidas por WhatsApp también aparece en tu cuenta, junto con todo lo demás.'],
];

/** Preguntas frecuentes en acordeón: una abierta por vez. */
export function Preguntas() {
  const [abierta, setAbierta] = useState(0);
  return (
    <section id="preguntas" className={clases.preguntas}>
      <div className={`${base.contenedor} ${clases.preguntasContenido}`}>
        <h2 className={`${base.tituloSeccion} ${clases.titulo}`}>
          Lo que nos preguntan <span className={base.oro}>todas las noches</span>
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
  );
}
