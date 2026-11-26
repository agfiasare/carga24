/**
 * Catálogo de permisos del staff. Cada funcionalidad tiene el suyo.
 * Los permisos se agrupan en perfiles editables; cada persona del staff
 * tiene un perfil y, opcionalmente, ajustes individuales.
 *
 * Regla: toda funcionalidad nueva del panel agrega su permiso acá.
 */

export const PERMISOS = {
  // Pedidos
  'pedidos.ver': { grupo: 'Pedidos', descripcion: 'Ver la cola y el historial' },
  'pedidos.crear': { grupo: 'Pedidos', descripcion: 'Registrar pedidos' },
  'pedidos.tomar': { grupo: 'Pedidos', descripcion: 'Tomar pedidos' },
  'pedidos.verificar': { grupo: 'Pedidos', descripcion: 'Verificar pagos y validar retiros' },
  'pedidos.acreditar': { grupo: 'Pedidos', descripcion: 'Marcar cargas como acreditadas' },
  'pedidos.pagar': { grupo: 'Pedidos', descripcion: 'Marcar retiros como pagados' },
  'pedidos.rechazar': { grupo: 'Pedidos', descripcion: 'Rechazar pedidos' },
  'pedidos.aprobar_retiro': { grupo: 'Pedidos', descripcion: 'Aprobar retiros grandes' },
  'pedidos.editar_cerrado': { grupo: 'Pedidos', descripcion: 'Corregir pedidos finalizados' },
  // Jugadores
  'jugadores.ver': { grupo: 'Jugadores', descripcion: 'Ver jugadores' },
  'jugadores.crear': { grupo: 'Jugadores', descripcion: 'Crear jugadores' },
  'jugadores.editar': { grupo: 'Jugadores', descripcion: 'Editar jugadores' },
  'jugadores.bloquear': { grupo: 'Jugadores', descripcion: 'Bloquear jugadores' },
  'jugadores.resetear_contrasena': { grupo: 'Jugadores', descripcion: 'Resetear contraseñas' },
  'cuentas.gestionar': { grupo: 'Jugadores', descripcion: 'Gestionar cuentas bancarias' },
  // Reportes y comisiones
  'reportes.ver': { grupo: 'Reportes y comisiones', descripcion: 'Ver reportes' },
  'reportes.exportar': { grupo: 'Reportes y comisiones', descripcion: 'Exportar a Excel' },
  'comisiones.ver_propias': { grupo: 'Reportes y comisiones', descripcion: 'Ver sus propias comisiones' },
  'liquidaciones.gestionar': { grupo: 'Reportes y comisiones', descripcion: 'Cerrar y pagar liquidaciones' },
  // Caja y turnos
  'turnos.opcional': { grupo: 'Caja y turnos', descripcion: 'Operar pedidos sin abrir turno (lo que acredita o paga va directo a la caja)' },
  'turnos.cerrar_ajenos': { grupo: 'Caja y turnos', descripcion: 'Cerrar turnos de otras personas' },
  'caja.ver': { grupo: 'Caja y turnos', descripcion: 'Ver la caja, los turnos y las rendiciones' },
  'caja.liquidar': { grupo: 'Caja y turnos', descripcion: 'Registrar liquidaciones de la caja' },
  'caja.ajustar': { grupo: 'Caja y turnos', descripcion: 'Cargar ajustes en la caja' },
  'rendiciones.registrar': { grupo: 'Caja y turnos', descripcion: 'Registrar rendiciones' },
  // Contenido y promociones
  'novedades.publicar': { grupo: 'Contenido y promociones', descripcion: 'Publicar novedades' },
  'avisos.enviar': { grupo: 'Contenido y promociones', descripcion: 'Enviar avisos a jugadores' },
  'promos.gestionar': { grupo: 'Contenido y promociones', descripcion: 'Gestionar promociones' },
  'promos.aplicar': { grupo: 'Contenido y promociones', descripcion: 'Aplicar códigos de promo en pedidos' },
  // Administración
  'configuracion.editar': { grupo: 'Administración', descripcion: 'Editar configuración' },
  'plataformas.gestionar': { grupo: 'Administración', descripcion: 'Gestionar plataformas' },
  'staff.gestionar': { grupo: 'Administración', descripcion: 'Gestionar staff' },
  'perfiles.gestionar': { grupo: 'Administración', descripcion: 'Gestionar perfiles de permisos' },
  'auditoria.ver': { grupo: 'Administración', descripcion: 'Ver auditoría' },
} as const satisfies Record<string, { grupo: string; descripcion: string }>;

export type Permiso = keyof typeof PERMISOS;

export const TODOS_LOS_PERMISOS = Object.keys(PERMISOS) as Permiso[];

export function esPermiso(valor: string): valor is Permiso {
  return Object.prototype.hasOwnProperty.call(PERMISOS, valor);
}

const OPERADOR: Permiso[] = [
  'pedidos.ver',
  'pedidos.crear',
  'pedidos.tomar',
  'pedidos.verificar',
  'pedidos.rechazar',
  'jugadores.ver',
  'jugadores.crear',
  'jugadores.editar',
  'jugadores.resetear_contrasena',
  'comisiones.ver_propias',
  'promos.aplicar',
];

/** Perfiles con los que arranca el sistema. El admin los edita y puede crear otros. */
export const PERFILES_INICIALES: Record<string, Permiso[]> = {
  Operador: OPERADOR,
  Pagos: ['pedidos.ver', 'pedidos.acreditar', 'pedidos.pagar', 'jugadores.ver', 'comisiones.ver_propias'],
  Supervisor: [
    ...OPERADOR,
    'pedidos.acreditar',
    'pedidos.pagar',
    'pedidos.aprobar_retiro',
    'pedidos.editar_cerrado',
    'jugadores.bloquear',
    'cuentas.gestionar',
    'reportes.ver',
    'reportes.exportar',
    'novedades.publicar',
    'avisos.enviar',
    'promos.gestionar',
    'turnos.cerrar_ajenos',
    'caja.ver',
  ],
  Admin: TODOS_LOS_PERMISOS,
};

export interface AjustePermiso {
  permiso: Permiso;
  tipo: 'agregar' | 'quitar';
}

/** Permisos efectivos = los del perfil + los agregados − los quitados. */
export function permisosEfectivos(delPerfil: readonly Permiso[], ajustes: readonly AjustePermiso[] = []): Set<Permiso> {
  const resultado = new Set<Permiso>(delPerfil);
  for (const ajuste of ajustes) {
    if (ajuste.tipo === 'agregar') resultado.add(ajuste.permiso);
    else resultado.delete(ajuste.permiso);
  }
  return resultado;
}
