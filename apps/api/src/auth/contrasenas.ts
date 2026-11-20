import { hash, verify } from '@node-rs/argon2';

// Hash fijo para comparar cuando el usuario no existe: así la respuesta tarda lo mismo
// y no se puede averiguar qué usuarios existen midiendo tiempos.
let hashDeRelleno: Promise<string> | undefined;

export function hashear(contrasena: string): Promise<string> {
  return hash(contrasena);
}

export async function verificarContrasena(hashGuardado: string | null | undefined, contrasena: string): Promise<boolean> {
  if (!hashGuardado) {
    hashDeRelleno ??= hash('relleno-para-igualar-tiempos');
    await verify(await hashDeRelleno, contrasena);
    return false;
  }
  try {
    return await verify(hashGuardado, contrasena);
  } catch {
    return false;
  }
}
