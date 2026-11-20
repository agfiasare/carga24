import { Injectable } from '@nestjs/common';
import { Subject, type Observable } from 'rxjs';

export interface EventoCola {
  tipo: 'pedido.creado' | 'pedido.actualizado';
  pedidoId: number;
  estado: string;
  /** Quién lo provocó (para no hacer sonar la cola de quien lo creó). */
  actorId: string | null;
}

/**
 * Avisos de la cola en vivo. Vive en memoria: alcanza mientras haya un solo
 * servidor de API (con varios, habría que pasar a Redis o a LISTEN/NOTIFY de Postgres).
 */
@Injectable()
export class EventosPedidos {
  private readonly canal = new Subject<EventoCola>();

  emitir(evento: EventoCola): void {
    this.canal.next(evento);
  }

  flujo(): Observable<EventoCola> {
    return this.canal.asObservable();
  }
}
