import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

/**
 * Limita intentos fallidos (ingreso, códigos 2FA): 8 en 15 minutos por clave.
 * Vive en memoria: alcanza para un solo servidor; se reinicia si la API se reinicia.
 */
@Injectable()
export class LimitadorIntentos {
  static readonly MAXIMO = 8;
  static readonly VENTANA_MS = 15 * 60 * 1000;

  private readonly fallos = new Map<string, number[]>();

  /** Lanza 429 si la clave ya agotó sus intentos. */
  verificar(clave: string, ahora = Date.now()): void {
    if (this.recientes(clave, ahora).length >= LimitadorIntentos.MAXIMO) {
      throw new HttpException(
        { mensaje: 'Demasiados intentos. Esperá 15 minutos y volvé a probar.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  registrarFallo(clave: string, ahora = Date.now()): void {
    const lista = this.recientes(clave, ahora);
    lista.push(ahora);
    this.fallos.set(clave, lista);
  }

  limpiar(clave: string): void {
    this.fallos.delete(clave);
  }

  private recientes(clave: string, ahora: number): number[] {
    const lista = (this.fallos.get(clave) ?? []).filter((t) => ahora - t < LimitadorIntentos.VENTANA_MS);
    if (lista.length === 0) this.fallos.delete(clave);
    return lista;
  }
}
