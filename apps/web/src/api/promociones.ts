import { api } from './cliente';

export interface PromoPublica {
  id: string;
  titulo: string;
  condiciones: string;
  codigo: string;
  hasta: string;
}

export interface PromoPanel extends PromoPublica {
  desde: string;
  activa: boolean;
  enLanding: boolean;
  enInicio: boolean;
  enNovedades: boolean;
  usos: number;
  situacion: 'vigente' | 'programada' | 'vencida' | 'pausada';
}

export interface DatosPromo {
  titulo: string;
  condiciones: string;
  codigo: string;
  desde: string;
  hasta: string;
  activa: boolean;
  enLanding: boolean;
  enInicio: boolean;
  enNovedades: boolean;
}

const id = encodeURIComponent;

export const promociones = {
  vigentes: (lugar: 'landing' | 'inicio' | 'novedades') => api<PromoPublica[]>('GET', `/promociones/vigentes?lugar=${lugar}`),
  validarJugador: (codigo: string) => api<PromoPublica>('GET', `/promociones/validar/${id(codigo.trim())}`),
  listar: () => api<PromoPanel[]>('GET', '/promociones'),
  crear: (datos: DatosPromo) => api<PromoPanel>('POST', '/promociones', datos),
  editar: (promoId: string, datos: Partial<DatosPromo>) => api<PromoPanel>('PATCH', `/promociones/${id(promoId)}`, datos),
  eliminar: (promoId: string) => api<void>('DELETE', `/promociones/${id(promoId)}`),
};

/** "Hasta el 22/11" en hora de Argentina. */
export function textoVigencia(hasta: string): string {
  return `Hasta el ${new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(hasta))}`;
}

/** Fecha AAAA-MM-DD (Argentina) de un instante guardado. */
export function fechaDe(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(iso));
}
