import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuditoriaModule } from './auditoria/auditoria.service.js';
import { AuthModule } from './auth/auth.module.js';
import { AutenticacionGuard } from './auth/autenticacion.guard.js';
import { PermisosGuard } from './auth/permisos.guard.js';
import { ConfiguracionModule } from './configuracion/configuracion.service.js';
import { NovedadesModule } from './novedades/novedades.js';
import { PedidosModule } from './pedidos/pedidos.module.js';
import { PortalModule } from './portal/portal.module.js';
import { PromocionesModule } from './promociones/promociones.js';
import { PublicoModule } from './publico.js';
import { ReportesModule } from './reportes/reportes.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SaludModule } from './salud/salud.module.js';
import { UsuariosModule } from './usuarios.module.js';

@Module({
  imports: [PrismaModule, AuditoriaModule, ConfiguracionModule, AuthModule, UsuariosModule, PedidosModule, PortalModule, NovedadesModule, ReportesModule, PromocionesModule, PublicoModule, SaludModule],
  providers: [
    // 1) ¿Quién es? (cookie de sesión) y ¿puede entrar a esta ruta? (@Publico, @SoloJugador, @SoloStaff…)
    { provide: APP_GUARD, useClass: AutenticacionGuard },
    // 2) ¿Tiene los permisos que pide la ruta? (@RequierePermisos)
    { provide: APP_GUARD, useClass: PermisosGuard },
  ],
})
export class AppModule {}
