import base from './landing.module.css';
import clases from './antes.module.css';

const CHAT: [string, string][] = [
  ['hola, me cargás 5 mil? ya te transferí', '21:02'],
  ['??', '21:20'],
  ['te mando el comprobante de nuevo', '21:43'],
  ['me cargaron o no???', '22:15'],
];

/** "Antes / ahora": el chat desordenado contra la cuenta con cada pedido registrado. */
export function AntesAhora() {
  return (
    <section id="antes" className={clases.antes}>
      <div className={`${base.contenedor} ${clases.contenido}`}>
        <h2 className={base.tituloSeccion}>
          Se terminó el <span className={clases.resaltado}>“¿me cargaste?”</span>
        </h2>
        <div className={clases.comparacion}>
          <div className={clases.columna}>
            <span className={clases.rotuloAntes}>Antes · cinco chats, cero respaldo</span>
            <div className={clases.chat}>
              {CHAT.map(([texto, hora]) => (
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
  );
}

function Fila({ titulo, detalle, monto, estado, tono }: { titulo: string; detalle: string; monto: string; estado: string; tono: 'ambar' | 'verde' }) {
  return (
    <div className={clases.filaCuenta}>
      <span className={clases.filaTexto}>
        <strong>{titulo}</strong>
        <small>{detalle}</small>
      </span>
      <span className={`${clases.filaMonto} ${monto.startsWith('+') ? base.verde : ''}`}>{monto}</span>
      <span className={tono === 'ambar' ? clases.pildoraAmbar : clases.pildoraVerde}>{estado}</span>
    </div>
  );
}
