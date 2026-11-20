import { Send } from 'lucide-react';
import { Boton, InsigniaEstado, Monto } from './componentes';
import clases from './App.module.css';

/**
 * Pantalla provisoria del Sprint 0: confirma que la app, los tokens y los
 * átomos funcionan. En los próximos sprints se reemplaza por las rutas reales
 * (landing, app del jugador y panel del staff).
 */
export function App() {
  return (
    <main className={clases.pagina}>
      <img src="/marca/carga24-logo-oro.png" alt="Carga24" className={clases.logo} />
      <h1 className={clases.titulo}>
        Cargá saldo y cobrá tus premios, <span className={clases.acento}>sin vueltas.</span>
      </h1>
      <p className={clases.texto}>Base del proyecto lista. Próximo paso: ingreso, usuarios y permisos.</p>
      <section className={clases.tarjeta} aria-label="Ejemplo de pedido">
        <div className={clases.fila}>
          <span>Carga #1291</span>
          <InsigniaEstado estado="en_proceso" tipo="carga" />
        </div>
        <Monto centavos={1_000_000} tamano="lg" destacado />
      </section>
      <Boton tamano="lg" icono={<Send size={18} aria-hidden="true" />}>
        Pedir carga
      </Boton>
    </main>
  );
}
