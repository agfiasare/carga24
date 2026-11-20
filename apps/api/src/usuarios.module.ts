import { Module } from '@nestjs/common';
import { JugadoresController, JugadoresService } from './jugadores/jugadores.js';
import { PerfilesController, PerfilesService } from './perfiles/perfiles.js';
import { StaffController, StaffService } from './staff/staff.js';

/** Gestión de jugadores, staff y perfiles de permisos desde el panel. */
@Module({
  controllers: [JugadoresController, StaffController, PerfilesController],
  providers: [JugadoresService, StaffService, PerfilesService],
})
export class UsuariosModule {}
