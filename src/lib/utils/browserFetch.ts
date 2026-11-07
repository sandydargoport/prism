/**
 * Headless browser fetch for sites that block server-side requests (Cloudflare).
 * Uses puppeteer-core with system-installed Chromium.
 * Falls back gracefully if Chromium is not available (local dev).
 *
 * Every request the page makes (the first navigation, each redirect, script
 * navigations, images and scripts) passes the same check as safeFetch, or is
 * aborted: the plain fetch before it checks only its own hops, and Chromium
 * would otherwise follow a recipe site's redirect onto the home network.
 */
import { assertPublicUrl, type SafeFetchOptions } from './safeFetch';


let puppeteer: typeof import('puppeteer-core') | null = null;

async function getPuppeteer() {
  if (puppeteer) return puppeteer;
  try {
    puppeteer = await import('puppeteer-core');
    return puppeteer;
  } catch {
    return null;
  }
}

/**
 * Fetch a URL using a headless browser to bypass Cloudflare bot protection.
 * Waits for the Cloudflare JS challenge to resolve, then extracts the page HTML.
 * Returns the page HTML or null if Chromium is not available or the page fails to load.
 */
export async function browserFetch(url: string, guard: SafeFetchOptions = {}): Promise<string | null> {
  const pptr = await getPuppeteer();
  if (!pptr) return null;

  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser';

  let browser;
  try {
    browser = await pptr.default.launch({
      executablePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--disable-extensions',
      ],
      timeout: 30000,
    });

    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      void assertPublicUrl(req.url(), guard).then(
        () => req.continue().catch(() => {}),
        () => req.abort('blockedbyclient').catch(() => {}),
      );
    });

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    // Set viewport to look like a real browser
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate — use domcontentloaded so we don't wait for all resources
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait for the Cloudflare challenge to resolve by checking for recipe JSON-LD
    // Cloudflare challenges typically redirect after solving, so we wait for the
    // actual page content to appear (indicated by schema.org JSON-LD or <title> change)
    try {
      await page.waitForSelector('script[type="application/ld+json"]', { timeout: 25000 });
    } catch {
      // If no JSON-LD appeared, wait a bit more and try networkidle
      try {
        await page.waitForNetworkIdle({ idleTime: 2000, timeout: 10000 });
      } catch { /* proceed with whatever we have */ }
    }

    const html = await page.content();
    return html;
  } catch (err) {
    console.error('Browser fetch failed:', err instanceof Error ? err.message : err);
    return null;
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }
}
