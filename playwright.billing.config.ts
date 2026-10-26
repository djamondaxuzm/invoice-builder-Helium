import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: ['invoice-list.spec.ts', 'logo-pdf.spec.ts'],
  workers: 1,
  timeout: 60000,
  use: {
    launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] },
    baseURL: 'http://127.0.0.1:5187',
    screenshot: 'only-on-failure'
  }
});
