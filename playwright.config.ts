import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/demos/**'],
  globalTeardown: './e2e/global-teardown.ts',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // The calendar grid again with the browser in a zone west of UTC. The
    // browser otherwise runs in the host's zone (UTC on CI), where a date read
    // with the wrong getters still lands on the right day. CI runs the
    // geometry step with the server in Asia/Tokyo, so browser, server and UTC
    // all disagree there.
    {
      name: 'chromium-chicago',
      testMatch: /calendar-geometry\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], timezoneId: 'America/Chicago' },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
