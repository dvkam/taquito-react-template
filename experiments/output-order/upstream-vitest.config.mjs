import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
const snapshot = process.env.SAPLING_SNAPSHOT;
if (snapshot !== 'baseline' && snapshot !== 'candidate')
  throw new Error('Choose baseline or candidate');
export default defineConfig({
  root: fileURLToPath(
    new URL(`../../.cache/output-order/${snapshot}/packages/taquito-sapling/`, import.meta.url),
  ),
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    isolate: true,
    include: ['test/**/*.spec.ts'],
    testTimeout: 30_000,
  },
});
