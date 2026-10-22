import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { 'inline-email': fileURLToPath(new URL('./src/index.ts', import.meta.url)) } },
  test: {
    coverage: {
      enabled: true,
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/types.ts'],
      thresholds: { lines: 99, branches: 99 }
    }
  }
});
