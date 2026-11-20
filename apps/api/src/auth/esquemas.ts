import { z } from 'zod';
import { normalizarTelefono } from '../comun/telefono.js';
import {
  esquemaCodigo2fa,
  esquemaContrasena,
  esquemaNombreUsuario,
  esquemaUsuarioPlataforma,
} from '../comun/validacion.js';

export const esquemaTelefono = z
  .string({ error: 'Falta el teléfono' })
  .transform((valor, ctx) => {
    const normalizado = normalizarTelefono(valor);
    if (!normalizado) {
      ctx.addIssue({ code: 'custom', message: 'El teléfono no es válido. Escribilo con código de área, por ejemplo 11 5555 0001' });
      return z.NEVER;
    }
    return normalizado;
  });

export const esquemaRegistro = z.object({
  usuarioPlataforma: esquemaUsuarioPlataforma,
  telefono: esquemaTelefono,
  nombreUsuario: esquemaNombreUsuario,
  contrasena: esquemaContrasena,
  mayorDeEdad: z.literal(true, { error: 'Tenés que confirmar que sos mayor de 18 años' }),
});

export const esquemaIngreso = z.object({
  identificador: z.string({ error: 'Falta el usuario o teléfono' }).trim().min(1, 'Falta el usuario o teléfono').max(60),
  contrasena: z.string({ error: 'Falta la contraseña' }).min(1, 'Falta la contraseña').max(128),
});

export const esquemaCambioContrasena = z.object({
  actual: z.string({ error: 'Falta la contraseña actual' }).min(1, 'Falta la contraseña actual').max(128),
  nueva: esquemaContrasena,
});

export const esquemaContrasenaNueva = z.object({ nueva: esquemaContrasena });

export const esquemaCodigo = z.object({ codigo: esquemaCodigo2fa });

export type DatosRegistro = z.infer<typeof esquemaRegistro>;
export type DatosIngreso = z.infer<typeof esquemaIngreso>;
export type DatosCambioContrasena = z.infer<typeof esquemaCambioContrasena>;
