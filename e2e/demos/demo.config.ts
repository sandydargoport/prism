import { defineConfig } from '@playwright/test';

/**
 * Playwright config for recording demo GIFs.
 * Runs scenarios sequentially with video capture at 1280x720.
 * Assumes the app is already running at localhost:3000.
 */
export default defineConfig({
  testDir: './scenarios',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 1280, height: 720 },
    video: {
      mode: 'on',
      size: { width: 1280, height: 720 },
    },
    launchOptions: {
      slowMo: 150,
    },
    colorScheme: 'light',
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: 'demos',
      use: {
        browserName: 'chromium',
        channel: 'chromium',
      },
    },
  ],
  // No webServer — app must already be running via docker-compose
});
