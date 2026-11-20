// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { tokens } from './tokens';

// Evita que tokens.ts y las variables de globales.css se desincronicen.
const css = readFileSync(fileURLToPath(new URL('./globales.css', import.meta.url)), 'utf8').toLowerCase();

describe('tokens', () => {
  it.each([
    ['--color-fondo', tokens.color.fondo],
    ['--color-superficie', tokens.color.superficie],
    ['--color-borde', tokens.color.borde],
    ['--color-texto', tokens.color.texto],
    ['--color-texto-secundario', tokens.color.textoSecundario],
    ['--color-primario', tokens.color.primario],
    ['--color-sobre-primario', tokens.color.sobrePrimario],
    ['--color-destacado', tokens.color.destacado],
    ['--color-ok', tokens.color.estado.ok],
    ['--color-en-proceso', tokens.color.estado.enProceso],
    ['--color-error', tokens.color.estado.error],
  ])('%s coincide con tokens.ts', (variable, valor) => {
    expect(css).toContain(`${variable}: ${valor.toLowerCase()};`);
  });
});
