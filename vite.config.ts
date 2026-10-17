import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env['PAGES_BASE_PATH'] ?? '/',
  plugins: [react({ compiler: { logDiagnostics: true } })],
  define: { global: 'globalThis' },
  build: { target: 'es2023' },
  resolve: {
    alias: {
      stream: 'stream-browserify',
      util: 'util',
      buffer: 'buffer',
    },
  },
});
