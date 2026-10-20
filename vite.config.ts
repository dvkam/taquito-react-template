import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const orderExperiment = process.env['OUTPUT_ORDER_EXPERIMENT'] === '1';

export default defineConfig({
  base: process.env['PAGES_BASE_PATH'] ?? '/',
  plugins: [react({ compiler: { logDiagnostics: true } })],
  define: { global: 'globalThis' },
  build: {
    target: 'es2023',
    ...(orderExperiment
      ? {
          rolldownOptions: {
            input: { main: 'index.html', order: 'experiments/output-order/index.html' },
          },
        }
      : {}),
  },
  resolve: {
    alias: {
      ...(orderExperiment
        ? {
            '@sapling-order/baseline': fileURLToPath(
              new URL(
                './.cache/output-order/baseline/packages/taquito-sapling/dist/taquito-sapling.es6.js',
                import.meta.url,
              ),
            ),
            '@sapling-order/candidate': fileURLToPath(
              new URL(
                './.cache/output-order/candidate/packages/taquito-sapling/dist/taquito-sapling.es6.js',
                import.meta.url,
              ),
            ),
          }
        : {}),
      stream: 'stream-browserify',
      util: 'util',
      buffer: 'buffer',
    },
  },
});
