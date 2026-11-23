import type { Page, Request } from '@playwright/test';

/**
 * Waits until the page has loaded and no request has been waiting on its
 * response for `quietMs`. Use this instead of `waitForLoadState('networkidle')`.
 *
 * networkidle waits for every response body to be read to the end. API
 * responses are sent `Cache-Control: no-store`, and with nothing to store
 * Chromium leaves a body the page never reads (a 401 the code only checks the
 * status of) open for as long as the page lives, so networkidle never comes on
 * any page that ignores one. A request counts as answered here once its
 * response arrives, which is what a test waiting for data actually needs.
 */
export async function waitForQuiet(page: Page, { quietMs = 500, timeout = 15_000 } = {}): Promise<void> {
  await page.waitForLoadState('load');

  const waiting = new Set<Request>();
  let lastChange = Date.now();
  const started = (request: Request) => {
    waiting.add(request);
    lastChange = Date.now();
  };
  const answered = (request: Request) => {
    waiting.delete(request);
    lastChange = Date.now();
  };
  const onResponse = (response: { request(): Request }) => answered(response.request());

  page.on('request', started);
  page.on('response', onResponse);
  page.on('requestfailed', answered);
  try {
    const deadline = Date.now() + timeout;
    while (waiting.size > 0 || Date.now() - lastChange < quietMs) {
      if (Date.now() > deadline) {
        const urls = [...waiting].map((r) => r.url()).join(', ');
        throw new Error(`waitForQuiet: network still busy after ${timeout}ms (waiting on: ${urls || 'none'})`);
      }
      await page.waitForTimeout(50);
    }
  } finally {
    page.off('request', started);
    page.off('response', onResponse);
    page.off('requestfailed', answered);
  }
}
