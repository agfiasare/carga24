import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

/**
 * Todas las respuestas de error tienen la misma forma: { mensaje, codigo?, errores? }.
 * Los errores no previstos se registran y se responden sin detalles internos.
 */
@Catch()
export class FiltroErrores implements ExceptionFilter {
  private readonly logger = new Logger('Errores');

  catch(error: unknown, host: ArgumentsHost): void {
    const respuesta = host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException) {
      const cuerpo = error.getResponse();
      const status = error.getStatus();
      if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
        respuesta.status(status).json({ mensaje: 'El archivo supera los 10 MB' });
        return;
      }
      if (typeof cuerpo === 'object' && cuerpo !== null && 'mensaje' in cuerpo) {
        respuesta.status(status).json(cuerpo);
        return;
      }
      const mensaje = typeof cuerpo === 'string' ? cuerpo : ((cuerpo as { message?: unknown }).message ?? error.message);
      respuesta.status(status).json({ mensaje: Array.isArray(mensaje) ? mensaje.join('. ') : String(mensaje) });
      return;
    }
    this.logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    respuesta.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ mensaje: 'Algo salió mal. Probá de nuevo en un rato.' });
  }
}
