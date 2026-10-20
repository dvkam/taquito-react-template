import { defineConfig, devices } from '@playwright/test';

const baseURL = `http://127.0.0.1:${process.env['PORT'] || '4180'}${process.env['PAGES_BASE_PATH'] || '/'}`;
export default defineConfig({
  testDir: './browser-tests',
  testMatch: '**/*.pw.ts',
  timeout: 120_000,
  workers: 1,
  reporter: 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  webServer: {
    command: 'node tools/serve-sapling.mjs',
    url: baseURL,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
