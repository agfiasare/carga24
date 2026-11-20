import { BadRequestException, PipeTransform } from '@nestjs/common';
import { z, type ZodType } from 'zod';

/**
 * Valida el cuerpo de una petición con un esquema de Zod.
 * Uso: @Body(new Validar(esquema)) datos: z.infer<typeof esquema>
 */
export class Validar<T> implements PipeTransform<unknown, T> {
  constructor(private readonly esquema: ZodType<T>) {}

  transform(valor: unknown): T {
    const resultado = this.esquema.safeParse(valor);
    if (!resultado.success) {
      const errores = resultado.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message }));
      throw new BadRequestException({ mensaje: errores[0]?.mensaje ?? 'Datos inválidos', errores });
    }
    return resultado.data;
  }
}

export const esquemaContrasena = z
  .string({ error: 'Falta la contraseña' })
  .min(8, 'La contraseña tiene que tener al menos 8 caracteres')
  .max(128, 'La contraseña es demasiado larga');

export const esquemaNombreUsuario = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_.]{3,30}$/, 'El nombre de usuario lleva de 3 a 30 letras, números, punto o guion bajo');

export const esquemaUsuarioPlataforma = z
  .string({ error: 'Falta el usuario de la plataforma' })
  .trim()
  .min(2, 'El usuario de la plataforma es muy corto')
  .max(60, 'El usuario de la plataforma es muy largo');

export const esquemaCodigo2fa = z.string().trim().regex(/^\d{6}$/, 'El código tiene 6 dígitos');
