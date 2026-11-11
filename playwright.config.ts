import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:4517',
    headless: true,
    launchOptions: {
      executablePath: process.env.MARGIN_CHROMIUM || '/usr/bin/chromium',
      args: ['--no-sandbox'],
    },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx tsx tests/browser-server.ts',
    url: 'http://127.0.0.1:4517/api/health',
    reuseExistingServer: false,
    timeout: 20000,
  },
});
