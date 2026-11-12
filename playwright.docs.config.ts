import { defineConfig, devices } from '@playwright/test';

// The docs site (mkdocs build -> site/) served as static files. Run after
// `mkdocs build`: npx playwright test -c playwright.docs.config.ts
export default defineConfig({
  testDir: './e2e-docs',
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:8765' },
  webServer: {
    command: 'python3 -m http.server 8765 -d site',
    url: 'http://127.0.0.1:8765/',
    reuseExistingServer: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
