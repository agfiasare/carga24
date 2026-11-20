import { Module } from '@nestjs/common';
import { PromocionesModule } from '../promociones/promociones.js';
import { AlmacenArchivos } from './archivos.js';
import { EventosPedidos } from './eventos.service.js';
import { PedidosController } from './pedidos.controller.js';
import { PedidosService } from './pedidos.service.js';

@Module({
  imports: [PromocionesModule],
  controllers: [PedidosController],
  providers: [PedidosService, EventosPedidos, AlmacenArchivos],
  exports: [PedidosService, EventosPedidos, AlmacenArchivos],
})
export class PedidosModule {}
