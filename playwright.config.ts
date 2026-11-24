import { defineConfig, devices } from '@playwright/test';

// The port the test server runs on. Locally, an existing server on it is
// reused only when E2E_REUSE_SERVER=1: on a machine that also runs a Prism
// install, the default port is that install, and a spec must never drive it
// (#1360). Without the flag, Playwright refuses to start when the port is taken.
const port = process.env.E2E_PORT || '3000';
const baseURL = `http://localhost:${port}`;

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
    baseURL,
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
    // The browser tests run on webpack, the bundler production builds use;
    // `npm run dev` is Turbopack for day-to-day work (see devBundler.test.ts).
    command: `npm run dev:webpack -- -p ${port} -H localhost`,
    url: baseURL,
    reuseExistingServer: !process.env.CI && process.env.E2E_REUSE_SERVER === '1',
  },
});
