import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/** Tipos aceptados, reconocidos por sus primeros bytes (no por la extensión ni lo que dice el navegador). */
export function detectarTipo(datos: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf' | null {
  if (datos.length >= 3 && datos[0] === 0xff && datos[1] === 0xd8 && datos[2] === 0xff) return 'image/jpeg';
  if (datos.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (datos.subarray(0, 4).toString('latin1') === 'RIFF' && datos.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (datos.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  return null;
}

/**
 * Guarda los comprobantes en disco (un volumen de Docker en producción).
 * El nombre del archivo es un UUID: nunca se usa el nombre que mandó el usuario.
 */
@Injectable()
export class AlmacenArchivos {
  private readonly directorio = resolve(process.env.DIRECTORIO_ARCHIVOS ?? 'archivos');

  async guardar(datos: Buffer): Promise<{ clave: string; mime: string }> {
    const mime = detectarTipo(datos);
    if (!mime) throw new BadRequestException('El comprobante tiene que ser una foto (JPG, PNG o WEBP) o un PDF');
    const clave = `comprobantes/${randomUUID()}`;
    await mkdir(join(this.directorio, 'comprobantes'), { recursive: true });
    await writeFile(join(this.directorio, clave), datos, { flag: 'wx' });
    return { clave, mime };
  }

  /** Borra un archivo que quedó huérfano (por ejemplo, si falló el alta del pedido). */
  async borrar(clave: string): Promise<void> {
    await rm(join(this.directorio, clave), { force: true });
  }

  leer(clave: string): ReadStream {
    if (!/^comprobantes\/[0-9a-f-]{36}$/.test(clave)) throw new Error('Clave de archivo inválida');
    return createReadStream(join(this.directorio, clave));
  }
}
