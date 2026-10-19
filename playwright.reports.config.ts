import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: 'reports.spec.ts',
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:5185',
    timezoneId: 'America/Los_Angeles',
    viewport: { width: 1280, height: 960 },
    screenshot: 'only-on-failure'
  }
});
