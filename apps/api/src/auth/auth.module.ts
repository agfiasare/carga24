import { Global, Module } from '@nestjs/common';
import { LimitadorIntentos } from '../comun/limitador.js';
import { AuthJugadorController } from './auth-jugador.controller.js';
import { AuthStaffController } from './auth-staff.controller.js';
import { AuthService } from './auth.service.js';
import { SesionesService } from './sesiones.service.js';

@Global()
@Module({
  controllers: [AuthJugadorController, AuthStaffController],
  providers: [AuthService, SesionesService, LimitadorIntentos],
  exports: [SesionesService],
})
export class AuthModule {}
