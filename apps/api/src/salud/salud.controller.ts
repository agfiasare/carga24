import { Controller, Get } from '@nestjs/common';
import { Publico } from '../auth/acceso.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface EstadoSalud {
  estado: 'ok';
  baseDeDatos: 'ok' | 'sin conexion';
  hora: string;
}

/** GET /api/v1/salud: lo usa Docker y el monitoreo para saber si la API está viva. */
@Publico()
@Controller('salud')
export class SaludController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async verificar(): Promise<EstadoSalud> {
    const baseOk = await this.prisma.estaDisponible();
    return { estado: 'ok', baseDeDatos: baseOk ? 'ok' : 'sin conexion', hora: new Date().toISOString() };
  }
}
