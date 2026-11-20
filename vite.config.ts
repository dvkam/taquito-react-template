import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const orderExperiment = process.env['OUTPUT_ORDER_EXPERIMENT'] === '1';
const orderBaselineSdk = process.env['SAPLING_ORDER_BASELINE_SDK'];
const orderCandidateSdk = process.env['SAPLING_ORDER_CANDIDATE_SDK'];
if (orderExperiment && (!orderBaselineSdk || !orderCandidateSdk)) {
  throw new Error(
    'Run pnpm experiment:order:browser to supply verified current SDK artifact paths.',
  );
}
const orderAliases =
  orderExperiment && orderBaselineSdk && orderCandidateSdk
    ? {
        '@sapling-order/baseline': orderBaselineSdk,
        '@sapling-order/candidate': orderCandidateSdk,
      }
    : {};

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
      ...orderAliases,
      stream: 'stream-browserify',
      util: 'util',
      buffer: 'buffer',
    },
  },
});
