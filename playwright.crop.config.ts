import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'crop-preview.spec.ts',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5184', channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  webServer: {
    command: 'npm run dev:react -- --host 127.0.0.1 --port 5184',
    url: 'http://127.0.0.1:5184',
    reuseExistingServer: true
  }
});
