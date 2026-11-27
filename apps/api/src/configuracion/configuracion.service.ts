import { Global, Injectable, Module } from '@nestjs/common';
import type { ModoComision } from '@carga24/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdministracionController, AdministracionService } from './configuracion.controller.js';

export interface ParametrosPedidos {
  comision: { modo: ModoComision; porcentajePb: number; impuestoPb: number };
  montos: { cargaMinima: number; cargaMaxima: number; retiroMinimo: number; retiroConAprobacionDesde: number };
  cuentasPendientesMaximas: number;
}

/** Lee la configuración del negocio (tabla configuracion), con valores por defecto seguros. */
@Injectable()
export class ConfiguracionService {
  constructor(private readonly prisma: PrismaService) {}

  async parametrosPedidos(): Promise<ParametrosPedidos> {
    const filas = await this.prisma.configuracion.findMany({
      where: { clave: { in: ['comision.modo', 'comision.porcentaje_pb', 'comision.impuesto_pb', 'montos.carga_minima', 'montos.carga_maxima', 'montos.retiro_minimo', 'montos.retiro_con_aprobacion_desde', 'cuentas.pendientes_maximas'] } },
    });
    const valor = new Map(filas.map((f) => [f.clave, f.valor as unknown]));
    const numero = (clave: string, defecto: number) => {
      const v = valor.get(clave);
      return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : defecto;
    };
    return {
      comision: {
        modo: valor.get('comision.modo') === 'descuento' ? 'descuento' : 'recargo',
        porcentajePb: numero('comision.porcentaje_pb', 0),
        impuestoPb: numero('comision.impuesto_pb', 0),
      },
      montos: {
        cargaMinima: numero('montos.carga_minima', 0),
        cargaMaxima: numero('montos.carga_maxima', Number.MAX_SAFE_INTEGER),
        retiroMinimo: numero('montos.retiro_minimo', 0),
        retiroConAprobacionDesde: numero('montos.retiro_con_aprobacion_desde', Number.MAX_SAFE_INTEGER),
      },
      cuentasPendientesMaximas: numero('cuentas.pendientes_maximas', 3),
    };
  }
}

@Global()
@Module({ controllers: [AdministracionController], providers: [ConfiguracionService, AdministracionService], exports: [ConfiguracionService] })
export class ConfiguracionModule {}
