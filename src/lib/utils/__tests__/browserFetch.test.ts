/**
 * The headless browser fallback for recipe sites checks every request its
 * page makes, not only the first URL (CodeQL js/request-forgery): Chromium
 * follows redirects and script navigations itself, so a recipe site could
 * otherwise send the server's browser onto the home network.
 */
type Req = { url: () => string; continue: jest.Mock; abort: jest.Mock };
let handler: ((r: Req) => void) | null = null;
const requests: Req[] = [];
const req = (url: string): Req => ({ url: () => url, continue: jest.fn().mockResolvedValue(undefined), abort: jest.fn().mockResolvedValue(undefined) });

jest.mock('puppeteer-core', () => ({
  __esModule: true,
  default: {
    launch: async () => ({
      newPage: async () => ({
        setRequestInterception: jest.fn(),
        on: (event: string, fn: (r: Req) => void) => { if (event === 'request') handler = fn; },
        setUserAgent: jest.fn(),
        setViewport: jest.fn(),
        goto: async () => { for (const r of requests) handler?.(r); },
        waitForSelector: jest.fn().mockResolvedValue(undefined),
        content: async () => '<html></html>',
      }),
      close: jest.fn(),
    }),
  },
}));

import { browserFetch } from '../browserFetch';

const flush = () => new Promise((r) => setTimeout(r, 10));

describe('browserFetch guards every request', () => {
  it('aborts private addresses and names that resolve inward, lets public ones through', async () => {
    const privateIp = req('http://10.0.0.5/admin');
    const metadata = req('http://169.254.169.254/latest/meta-data/');
    const inward = req('https://inward.example/recipe');
    const outward = req('https://recipes.example/pie');
    requests.push(privateIp, metadata, inward, outward);
    const resolveHost = async (host: string) => (host === 'inward.example' ? ['192.168.1.20'] : ['93.184.216.34']);

    const html = await browserFetch('https://recipes.example/pie', { isProduction: true, resolveHost, allowedInternalHosts: [] });
    await flush();

    expect(html).toBe('<html></html>');
    for (const blocked of [privateIp, metadata, inward]) {
      expect(blocked.abort).toHaveBeenCalled();
      expect(blocked.continue).not.toHaveBeenCalled();
    }
    expect(outward.continue).toHaveBeenCalled();
    expect(outward.abort).not.toHaveBeenCalled();
  });
});
