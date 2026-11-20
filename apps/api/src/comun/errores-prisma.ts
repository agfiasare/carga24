import { ConflictException } from '@nestjs/common';

/** Columna con valor único → mensaje para la persona. */
const MENSAJES: Record<string, string> = {
  telefono: 'Ese teléfono ya tiene una cuenta',
  nombre_usuario: 'Ese nombre de usuario ya está en uso',
  nombre: 'Ya existe uno con ese nombre',
};

interface MetaDuplicado {
  target?: string | string[];
  driverAdapterError?: { cause?: { constraint?: { index?: string; fields?: string[] } } };
}

/** Convierte un choque de valor único de la base (P2002) en un 409 con mensaje claro. */
export function traducirDuplicado(error: unknown): never {
  if (typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002') {
    const meta = (error as { meta?: MetaDuplicado }).meta;
    const restriccion = meta?.driverAdapterError?.cause?.constraint;
    // Postgres nombra los índices únicos "<tabla>_<columna>_key".
    const pistas = [
      ...[meta?.target ?? []].flat(),
      ...(restriccion?.fields ?? []),
      ...(restriccion?.index ? [restriccion.index] : []),
    ].map((p) => p.replace(/"/g, ''));
    const columna = Object.keys(MENSAJES)
      .sort((a, b) => b.length - a.length)
      .find((c) => pistas.some((p) => p === c || p.endsWith(`_${c}_key`)));
    throw new ConflictException(columna ? MENSAJES[columna] : 'Ya existe un registro con esos datos');
  }
  throw error;
}
