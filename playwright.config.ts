import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm.cmd start',
    url: 'http://127.0.0.1:4174/api/health',
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      PORT: '4174',
      MOCK_AI: '1',
      MOCK_DELAY_MS: '10',
    },
  },
});
