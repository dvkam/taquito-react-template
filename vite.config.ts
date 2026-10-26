import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const orderExperiment = process.env['OUTPUT_ORDER_EXPERIMENT'] === '1';
const orderBaselineSdk = process.env['SAPLING_ORDER_BASELINE_SDK'];
const orderCandidateSdk = process.env['SAPLING_ORDER_CANDIDATE_SDK'];
if (orderExperiment && Boolean(orderBaselineSdk) !== Boolean(orderCandidateSdk)) {
  throw new Error('Supply both output-order SDK artifact paths, or neither.');
}

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
            '@sapling-order/baseline':
              orderBaselineSdk ??
              fileURLToPath(
                new URL(
                  './.cache/output-order/baseline/packages/taquito-sapling/dist/taquito-sapling.es6.js',
                  import.meta.url,
                ),
              ),
            '@sapling-order/candidate':
              orderCandidateSdk ??
              fileURLToPath(
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
