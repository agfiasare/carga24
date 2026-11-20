import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PermisosGuard } from './auth/permisos.guard.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SaludModule } from './salud/salud.module.js';

@Module({
  imports: [PrismaModule, SaludModule],
  providers: [
    // Toda ruta marcada con @RequierePermisos(...) queda protegida automáticamente.
    { provide: APP_GUARD, useClass: PermisosGuard },
  ],
})
export class AppModule {}
