import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: ['packaged.spec.ts'],
  timeout: 120000,
  workers: 1,
  outputDir: 'test-results/packaged',
  use: { screenshot: 'only-on-failure' }
});
