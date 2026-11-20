import { Module } from '@nestjs/common';
import { AlmacenArchivos } from './archivos.js';
import { EventosPedidos } from './eventos.service.js';
import { PedidosController } from './pedidos.controller.js';
import { PedidosService } from './pedidos.service.js';

@Module({
  controllers: [PedidosController],
  providers: [PedidosService, EventosPedidos, AlmacenArchivos],
  exports: [PedidosService, EventosPedidos],
})
export class PedidosModule {}
