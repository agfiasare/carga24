import { Link } from 'react-router';
import { textoVigencia, type PromoPublica } from '../../api/promociones';
import base from './landing.module.css';
import clases from './cupon.module.css';

/** La promo vigente para la landing, con forma de cupón con talón. */
export function Cupon({ promo, destino }: { promo: PromoPublica; destino: string }) {
  return (
    <section className={base.contenedor} aria-label="Promoción">
      <div className={clases.cupon}>
        <div className={clases.cuponCuerpo}>
          <span className={clases.cuponRotulo}>Cupón · {textoVigencia(promo.hasta).toLowerCase()}</span>
          <span className={clases.cuponTitulo}>{promo.titulo}</span>
          <span className={clases.cuponCondiciones}>{promo.condiciones}</span>
        </div>
        <div className={clases.talon}>
          <span className={clases.muescaArriba} aria-hidden="true" />
          <span className={clases.muescaAbajo} aria-hidden="true" />
          <span className={clases.cuponCodigoRotulo}>Código</span>
          <span className={clases.cuponCodigo}>{promo.codigo}</span>
          <Link to={destino} className={base.botonVerde}>
            Usar el cupón
          </Link>
        </div>
      </div>
    </section>
  );
}
