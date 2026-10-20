import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: '**/output-order*.pw.ts',
  outputDir: 'test-results/output-order',
  projects: base.projects?.filter((project) => project.name === 'chromium') ?? [],
});
