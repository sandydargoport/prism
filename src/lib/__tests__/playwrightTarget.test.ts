/**
 * @jest-environment node
 *
 * A local Playwright run never drives a server it did not start, unless the
 * run asks to (#1360): on a machine that runs a Prism install, the default
 * port is that install.
 */
jest.mock('@playwright/test', () => ({
  defineConfig: (c: unknown) => c,
  devices: { 'Desktop Chrome': {} },
}));

type Cfg = { use: { baseURL: string }; webServer: { url: string; reuseExistingServer: boolean; command: string } };

function load(env: Record<string, string | undefined>): Cfg {
  const saved = { ...process.env };
  for (const k of ['CI', 'E2E_PORT', 'E2E_REUSE_SERVER']) delete process.env[k];
  Object.assign(process.env, env);
  let cfg!: Cfg;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cfg = require('../../../playwright.config').default as Cfg;
  });
  process.env = saved;
  return cfg;
}

describe('Playwright test server target', () => {
  it('does not reuse a running server by default', () => {
    expect(load({}).webServer.reuseExistingServer).toBe(false);
  });

  it('reuses one only when the run asks', () => {
    expect(load({ E2E_REUSE_SERVER: '1' }).webServer.reuseExistingServer).toBe(true);
    expect(load({ E2E_REUSE_SERVER: '1', CI: 'true' }).webServer.reuseExistingServer).toBe(false);
  });

  it('runs on E2E_PORT when set', () => {
    const cfg = load({ E2E_PORT: '3251' });
    expect(cfg.use.baseURL).toBe('http://localhost:3251');
    expect(cfg.webServer.url).toBe('http://localhost:3251');
    expect(cfg.webServer.command).toContain('-p 3251');
  });
});
