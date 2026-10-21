import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { 'inline-email': fileURLToPath(new URL('./src/index.ts', import.meta.url)) } }
});
