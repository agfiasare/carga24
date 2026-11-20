import swc from 'unplugin-swc';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

// Tests de punta a punta: levantan la API y usan una base PostgreSQL real (DATABASE_URL).
// ¡Borran todos los datos de esa base! Usar solo con una base de prueba.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.e2e.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      CLAVE_CIFRADO: Buffer.alloc(32, 1).toString('base64'),
      CORS_ORIGINS: 'http://localhost:5173',
      DIRECTORIO_ARCHIVOS: join(tmpdir(), 'carga24-e2e-archivos'),
    },
  },
});
