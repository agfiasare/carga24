import { Module } from '@nestjs/common';
import { PedidosModule } from '../pedidos/pedidos.module.js';
import { CajaController } from './caja.controller.js';
import { CajaService } from './caja.service.js';

@Module({ imports: [PedidosModule], controllers: [CajaController], providers: [CajaService] })
export class CajaModule {}
