import { Module } from '@nestjs/common';
import { PedidosModule } from '../pedidos/pedidos.module.js';
import { PortalController } from './portal.controller.js';
import { PortalService } from './portal.service.js';

/** Portal del jugador: pedidos, cuentas, avisos y novedades desde la web. */
@Module({ imports: [PedidosModule], controllers: [PortalController], providers: [PortalService] })
export class PortalModule {}
