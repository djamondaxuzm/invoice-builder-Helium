import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: 'receipts.spec.ts',
  workers: 1,
  timeout: 120000,
  use: { baseURL: 'http://127.0.0.1:5187', viewport: { width: 1280, height: 960 }, screenshot: 'only-on-failure' }
});
