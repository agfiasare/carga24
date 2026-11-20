import { SetMetadata } from '@nestjs/common';

export const ACCESO = 'acceso';

/**
 * Quién puede usar una ruta. Toda ruta tiene que declararlo (en el método o el controlador);
 * si no lo hace, el guard la trata como 'staff', la opción más restrictiva.
 * - publico: cualquiera, sin sesión.
 * - jugador: sesión de jugador.
 * - staff: sesión de staff completa (contraseña + 2FA).
 * - staff_pendiente: sesión de staff a mitad del ingreso (cambio de contraseña / 2FA).
 */
export type Acceso = 'publico' | 'jugador' | 'staff' | 'staff_pendiente';

export const Publico = () => SetMetadata(ACCESO, 'publico' satisfies Acceso);
export const SoloJugador = () => SetMetadata(ACCESO, 'jugador' satisfies Acceso);
export const SoloStaff = () => SetMetadata(ACCESO, 'staff' satisfies Acceso);
export const StaffPendiente = () => SetMetadata(ACCESO, 'staff_pendiente' satisfies Acceso);

export const PERMITE_CONTRASENA_VENCIDA = 'permiteContrasenaVencida';

/** La ruta se puede usar aunque el jugador tenga que cambiar su contraseña temporal. */
export const PermiteContrasenaVencida = () => SetMetadata(PERMITE_CONTRASENA_VENCIDA, true);
