import { Global, Injectable, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaController } from './auditoria.controller.js';
import type { Prisma } from '../generated/prisma/client.js';

export interface RegistroAuditoria {
  actorId: string | null;
  accion: string;
  entidad: string;
  entidadId?: string | null;
  datos?: Prisma.InputJsonValue;
  ip?: string | null;
}

/** Deja constancia de cada acción relevante. La tabla solo admite inserciones. */
@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(registro: RegistroAuditoria, cliente: Pick<PrismaService, 'auditoria'> = this.prisma): Promise<void> {
    await cliente.auditoria.create({
      data: {
        actorId: registro.actorId,
        accion: registro.accion,
        entidad: registro.entidad,
        entidadId: registro.entidadId ?? null,
        datos: registro.datos,
        ip: registro.ip ?? null,
      },
    });
  }
}

@Global()
@Module({ controllers: [AuditoriaController], providers: [AuditoriaService], exports: [AuditoriaService] })
export class AuditoriaModule {}
