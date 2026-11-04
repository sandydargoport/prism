/**
 * Auto-capture screenshots of every Prism feature for the docs site.
 *
 * Run against the screenshots stack (port :3010), which builds from the current
 * source and seeds the demo family:
 *
 *   docker-compose -f docker-compose.screenshots.yml up -d
 *   # ... wait ~90s for first boot ...
 *   npm run screenshots:capture
 *
 * IMPORTANT: capture only against an instance running CURRENT master, or the
 * shots will show stale UI.
 *
 * This refuses to run without E2E_HAS_TEST_DB=1, the same gate every Playwright
 * spec carries. Everything it writes lands in docs/demos/, which is tracked and
 * published to the docs site, and no scanner in this repo can read a pixel. So
 * the only defence against a shot of the real family dashboard being committed
 * is that the script cannot be pointed at a real instance in the first place.
 * The workflow that refreshes these (refresh-screenshots.yml) sets the flag
 * against an ephemeral seeded database.
 *
 * Photos: the seed does not create photos (they need image bytes), so before
 * capturing this script uploads the park photos Prism ships (public/scenery)
 * into the target if it has none, and pins one as the dashboard wallpaper. That
 * keeps the Photos page, the dashboard hero, and the screensaver populated with
 * no manual prep and no network.
 *
 * Saves to docs/demos/ with stable filenames so the docs site + README
 * references stay valid across re-runs. Captures both light + dark theme for the
 * main dashboard, plus mobile viewport variants.
 *
 * Login is automatic, using Alex (parent) with PIN 1234 from the seed. No setup
 * wizard needed; the seed pre-creates users + settings + layout.
 *
 * Fixed clock: set PRISM_SEED_NOW (and TZ, default America/Chicago) for both
 * the seed and this script, and every shot draws the same moment. The refresh
 * workflow does.
 *
 * Hero set (`npm run screenshots:capture -- hero`): the same moment on a 1080p
 * touch wall and a tablet (signed out) and a phone (signed in), light and dark,
 * on the Family Central layout. frame-screenshots.ts then puts each trio into
 * device frames: docs/demos/hero-light.png and hero-dark.png. Design rules for
 * what those screens should look like are in docs/DESIGN.md.
 *
 * Gallery set (`-- look- idle- widget- phone-`): what a family sees, for
 * docs/screenshots.md: the wall in each look, its idle screen, the calendar,
 * chores and shopping widgets close up, and a parent's phone. The list of
 * shots lives in screenshot-specs.ts.
 */

import { chromium, Browser, BrowserContext, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { frameAll } from './frame-screenshots';
import { SCENERY } from '../src/lib/scenery';
import { freezeWeather } from './frozen-weather';
import { LOOKS } from '../src/lib/looks';
import { DEVICES, SCREENSHOTS, STAGE_LAYOUTS, themeOf, type CaptureSpec, type Stage } from './screenshot-specs';

// Refuse to run against anything that is not a declared test database. This is
// the same flag e2e/*.spec.ts gate on. It is a deliberate choice rather than a
// URL allowlist: the person running this knows whether the target is seeded,
// and a hostname cannot be trusted to say so.
if (process.env.E2E_HAS_TEST_DB !== '1') {
  console.error(
    'capture-screenshots: refusing to run without E2E_HAS_TEST_DB=1.\n' +
    '\n' +
    'This writes into docs/demos/, which is committed and published, and no\n' +
    'scanner here can read an image. Point it at the screenshots stack:\n' +
    '\n' +
    '  docker-compose -f docker-compose.screenshots.yml up -d\n' +
    '  E2E_HAS_TEST_DB=1 npm run screenshots:capture\n'
  );
  process.exit(1);
}

const BASE_URL = process.env.PRISM_URL || 'http://localhost:3010';
const PIN = '1234';
const OUT_DIR = path.resolve(__dirname, '..', 'docs', 'demos');

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 }; // iPhone 14

/**
 * A fixed clock, so a re-run draws the same day. The seed takes the same
 * instant (PRISM_SEED_NOW), so the fixtures and the page agree on "today".
 * setFixedTime, not clock.install: Date is frozen, intervals still run.
 */
const FIXED_NOW = process.env.PRISM_SEED_NOW;

/** The demo family lives in Springfield, IL. The seed must run in the same zone. */
const TIMEZONE = process.env.TZ || 'America/Chicago';

async function loginAsAlex(page: Page) {
  const familyResp = await page.request.get('/api/family');
  const familyJson = await familyResp.json();
  const members = Array.isArray(familyJson) ? familyJson : familyJson.members;
  const alex = members.find((m: { name: string }) => m.name === 'Alex');
  if (!alex) throw new Error('Alex not found in /api/family — did the seed run?');

  const data: Record<string, unknown> = { pin: PIN };
  if (alex.id) data.userId = alex.id;
  else if (typeof alex.loginIndex === 'number') data.memberIndex = alex.loginIndex;
  else throw new Error('Alex has neither id nor loginIndex');

  const loginResp = await page.request.post('/api/auth/login', { data });
  if (!loginResp.ok()) {
    throw new Error(`Login failed: ${loginResp.status()} ${await loginResp.text()}`);
  }
}

/**
 * The park photos Prism ships (public/scenery, public domain, credited in
 * CREDITS.md). Read from disk, so a capture needs no network and never puts
 * someone else's copyrighted photo in the published screenshots.
 */
function loadBundledScenery(): { name: string; buffer: Buffer }[] {
  return SCENERY.map((s) => ({
    name: `${s.id}.webp`,
    buffer: fs.readFileSync(path.join(process.cwd(), 'public', s.src)),
  }));
}

/**
 * Make sure the target has demo photos before capturing. The seed omits photos
 * (they need image bytes), so if the instance has none we upload the bundled
 * park scenery through the real upload API (which builds thumbnails, dimensions,
 * orientation, and tags them wallpaper+gallery+screensaver). Best-effort: any
 * failure leaves the photo-dependent shots empty rather than aborting capture.
 */
async function ensureDemoPhotos(browser: Browser): Promise<void> {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  try {
    await page.goto('/', { waitUntil: 'load', timeout: 60_000 });
    await loginAsAlex(page);

    const resp = await page.request.get('/api/photos?limit=1');
    const json = await resp.json();
    const list = Array.isArray(json) ? json : (json.photos ?? []);
    if (list.length > 0) {
      console.log('  photos already present — skipping the scenery seed');
      return;
    }

    console.log('  no photos found — uploading the bundled park scenery...');
    const images = loadBundledScenery();
    let uploaded = 0;
    for (const img of images) {
      const up = await page.request.post('/api/photos', {
        multipart: { file: { name: img.name, mimeType: 'image/webp', buffer: img.buffer } },
      });
      if (up.ok()) uploaded++;
    }
    console.log(`  uploaded ${uploaded} wallpaper photo(s)`);
  } catch (err) {
    console.warn(`  photo seed skipped: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await context.close();
  }
}

/**
 * Stage the seeded install in one of a new install's looks (#808, the LOOKS
 * table the setup wizard applies): the look's palette, its card fill and,
 * for Photo and Night, the bundled park scenery (shown only while the install
 * has no photos of its own, which is why staged shots run before
 * ensureDemoPhotos), on the hero's or the gallery's dashboard. Signed-out
 * screens show the display member's default layout, which is this one.
 * Returns a function that puts everything back.
 */
async function stageLook(browser: Browser, stage: Stage): Promise<() => Promise<void>> {
  const look = LOOKS[stage.look];
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await page.goto('/', { waitUntil: 'load', timeout: 60_000 });
  await loginAsAlex(page);
  const listed = await page.request.get('/api/layouts');
  const json = await listed.json().catch(() => ({}));
  type Listed = { id: string; name?: string; isDefault?: boolean; widgets: unknown; idleBackground?: unknown };
  const all: Listed[] = json.layouts ?? [];
  const layout = all.find((l) => l.isDefault);
  if (!layout) {
    await context.close();
    // Say what came back: a failed request and a list without a default need
    // different fixes, and the run log is all there is to go on.
    const seen = all.map((l) => `${l.name}${l.isDefault ? ' (default)' : ''}`).join(', ') || 'none';
    throw new Error(
      `No default layout to stage the ${stage.look} look: GET /api/layouts answered ${listed.status()}, ` +
        `layouts: ${seen}${json.error ? `, error: ${json.error}` : ''}`,
    );
  }
  const settings = (await (await page.request.get('/api/settings')).json()) as Record<string, unknown>;
  const setSetting = (key: string, value: unknown) =>
    page.request.patch('/api/settings', { data: { key, value } });

  const original = {
    widgets: layout.widgets, idleBackground: layout.idleBackground,
    theme: settings.theme, scenery: settings.wallpaperScenery,
  };
  const widgets = STAGE_LAYOUTS[stage.layout].map((w) =>
    look.fill ? { ...w, backgroundColor: look.fill } : w,
  );
  for (const resp of [
    await page.request.patch(`/api/layouts/${layout.id}`, {
      data: { widgets, idleBackground: { source: 'dashboard' } },
    }),
    await setSetting('theme', { ...(original.theme as object | undefined), paletteId: look.paletteId }),
    await setSetting('wallpaperScenery', look.scenery),
  ]) {
    if (!resp.ok()) throw new Error(`Staging the ${stage.look} look failed: ${resp.status()}`);
  }
  console.log(`  staged the ${stage.look} look on the ${stage.layout} dashboard`);
  return async () => {
    // Check each answer: a restore that fails quietly leaves the next staging
    // to start from whatever this one left behind.
    const answers = [
      await page.request.patch(`/api/layouts/${layout.id}`, {
        data: { widgets: original.widgets, idleBackground: original.idleBackground ?? { source: 'photos' } },
      }),
      await setSetting('theme', original.theme ?? { mode: 'system' }),
      await setSetting('wallpaperScenery', original.scenery ?? false),
    ];
    await context.close();
    const failed = answers.filter((r) => !r.ok());
    if (failed.length > 0) {
      throw new Error(`Restoring after the ${stage.look} look failed: ${failed.map((r) => `${r.url()} ${r.status()}`).join(', ')}`);
    }
  };
}

/**
 * Wait until any loading indicators have disappeared. Next.js dev mode
 * compiles each route on first hit, taking several seconds, during which
 * the page shows "Loading shopping lists…" / a "Prism" splash / skeleton
 * placeholders. Polling for their absence is more reliable than a fixed
 * sleep that risks capturing the splash.
 */
async function waitForContentReady(page: Page, settleMs = 3500): Promise<void> {
  // Poll until none of: the "Prism" splash, an empty body, a generic
  // "Loading..." indicator, or a "Loading X Y Z..." status message
  // (matches "Loading shopping lists...", "Loading travel pins...", etc.).
  // Skeleton/spinner elements indicate the page rendered the chrome but the
  // data hasn't arrived; we wait for them to disappear too.
  await page
    .waitForFunction(
      () => {
        const text = document.body.innerText.trim();
        if (!text || text === 'Prism') return false;
        if (/Loading[\s\w]*(\.\.\.|…)/i.test(text)) return false;
        // Skeleton placeholders (animate-pulse) and spinners (animate-spin)
        // are both indicators that content is still loading.
        const loaders = document.querySelectorAll(
          '[class*="animate-pulse"], [class*="animate-spin"], [class*="skeleton"], [data-loading="true"]',
        );
        if (loaders.length > 0) return false;
        return true;
      },
      { timeout: 30_000, polling: 250 },
    )
    .catch(() => {
      // Best-effort — fall through to the static settle delay if we time out.
    });
  await page.waitForTimeout(settleMs);
}

/** One browser per pointer type, launched on first use (see DEVICES). */
const browsers = new Map<'fine' | 'coarse', Promise<Browser>>();
function browserFor(spec: CaptureSpec): Promise<Browser> {
  const pointer = spec.device ? 'coarse' : 'fine';
  if (!browsers.has(pointer)) {
    browsers.set(
      pointer,
      chromium.launch(
        pointer === 'coarse'
          ? { args: ['--blink-settings=primaryPointerType=2,availablePointerTypes=2'] }
          : {},
      ),
    );
  }
  return browsers.get(pointer)!;
}

async function captureOnce(spec: CaptureSpec): Promise<void> {
  const browser = await browserFor(spec);
  const device = spec.device ? DEVICES[spec.device] : null;
  const viewport = device?.viewport ?? (spec.mobile ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT);
  const context: BrowserContext = await browser.newContext({
    baseURL: BASE_URL,
    viewport,
    deviceScaleFactor: device?.scale ?? 1,
    isMobile: device?.isMobile ?? false,
    hasTouch: Boolean(device),
    timezoneId: TIMEZONE,
    reducedMotion: 'reduce',
    colorScheme: themeOf(spec) === 'dark' ? 'dark' : 'light',
  });

  const page = await context.newPage();
  // This screen's own auto-hide choice, so the rail and bar hide whatever the
  // household default is (it is on only for the scenery look).
  if (spec.idleChrome) {
    await page.addInitScript(() => {
      try { localStorage.setItem('prism:auto-hide-ui', 'true'); } catch { /* storage blocked */ }
    });
  }
  if (FIXED_NOW) {
    await page.clock.setFixedTime(new Date(FIXED_NOW));
    // The forecast is live; draw the fixed moment's weather instead, or a June
    // afternoon shows November's hours, sunrise and sunset.
    await context.route('**/api/weather**', async (route) => {
      const response = await route.fetch();
      if (!response.ok()) return route.fulfill({ response });
      await route.fulfill({ response, json: freezeWeather(await response.json(), FIXED_NOW) });
    });
  }

  // Pre-seed localStorage BEFORE first paint so the page renders directly in
  // the requested state (theme + calendar view) without a mid-load swap.
  // Without this, switching state after mount re-triggers widget loading
  // states and the settle wait can capture a half-loaded view.
  await page.addInitScript(
    ({ theme, calendarView, calendarWeekCount, calendarDisplayMode }) => {
      try {
        if (theme) {
          // ThemeProvider reads the 'prism-theme' key (not 'theme') and toggles
          // only the 'dark' class on <html>.
          localStorage.setItem('prism-theme', theme);
          document.documentElement.classList.toggle('dark', theme === 'dark');
        }
        if (calendarView) {
          localStorage.setItem('prism-calendar-view-type', calendarView);
        }
        if (calendarWeekCount) {
          localStorage.setItem('prism-calendar-week-count', String(calendarWeekCount));
        }
        if (calendarDisplayMode) {
          localStorage.setItem('prism-calendar-display-mode', calendarDisplayMode);
          // In cards mode, also enable meal/chore/task overlays so the cards
          // visually demonstrate what cards mode is for (extra rows under each
          // day with the day's tasks, chores, and meals).
          if (calendarDisplayMode === 'cards') {
            localStorage.setItem(
              'prism-calendar-overlays',
              JSON.stringify({ events: true, meals: true, chores: true, tasks: true }),
            );
          }
        }
      } catch {}
    },
    {
      theme: themeOf(spec) ?? null,
      calendarView: spec.calendarView ?? null,
      calendarWeekCount: spec.calendarWeekCount ?? null,
      calendarDisplayMode: spec.calendarDisplayMode ?? null,
    },
  );

  try {
    // Login first (against the base URL — sets auth cookies on the context).
    // Use 'load' rather than 'networkidle': Next.js dev mode keeps a hot-reload
    // websocket open, so networkidle never fires and every navigation times out.
    await page.goto('/', { waitUntil: 'load', timeout: 60_000 });
    await loginAsAlex(page);

    // A wall runs signed out. Signing in above was only to find the photo.
    if (spec.signedOut) await context.clearCookies();

    // Navigate to the target page.
    await page.goto(spec.url, { waitUntil: 'load', timeout: 60_000 });

    // Hide Next.js dev-mode overlays (the "N" build-status badge in the
    // bottom-left, the issue toast, and any error dialog). These are rendered
    // into a fixed-position `nextjs-portal` element that's irrelevant to docs
    // screenshots but would otherwise overlay every capture.
    await page.addStyleTag({
      content: `
        nextjs-portal,
        [data-nextjs-toast],
        [data-nextjs-dialog-overlay],
        #__next-build-watcher,
        [data-next-mark-loading] { display: none !important; }
      `,
    });

    if (spec.setup) {
      await spec.setup(page);
    }

    // Wait for content to be ready (loading indicators gone), then a small
    // extra settle for animations + render finalization. Pass through the
    // spec's settleMs override; otherwise the function default applies.
    await waitForContentReady(page, spec.settleMs);

    // In dev mode a signed-out load can open "Sign in to make changes" on its
    // own: the time-zone backfill in TimeFormatProvider runs when its effect is
    // cancelled, and dev runs effects twice. Close it until that is fixed.
    if (spec.signedOut) {
      // The box has no dialog role and ignores Escape, so press its close button.
      const title = page.getByText('Sign in to make changes');
      if (await title.isVisible().catch(() => false)) {
        await title.locator('xpath=ancestor::div[.//button][1]').locator('button').first().click();
        await title.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(500);
      }
    }

    // Auto-hide takes the rail and bar away after 10 s without a touch; the
    // click above counts as one. Wait until the content has lost the rail's
    // margin rather than for a fixed time, and fail rather than ship a shot
    // with the chrome still showing.
    if (spec.idleChrome) {
      await page
        .waitForFunction(() => !document.querySelector('main')?.classList.contains('ml-16'), null, { timeout: 20_000 })
        .catch(() => {
          throw new Error(`${spec.name}: the side rail and top bar did not auto-hide`);
        });
      await page.waitForTimeout(800); // let the slide-out finish
    }
    if (spec.idle) {
      // The toolbar's "screensaver now" event, which a calm dashboard answers
      // by fading in place rather than opening the separate screensaver.
      await page.evaluate(() => window.dispatchEvent(new Event('prism:screensaver')));
      await page.waitForTimeout(2500);
    }

    // Wait for any <img> (photo thumbnails, recipe images, avatars) to finish
    // loading. waitForContentReady only tracks spinners/skeletons, not images,
    // so without this the Photos gallery can capture blank thumbnails.
    await page.evaluate(async () => {
      const imgs = Array.from(document.images);
      await Promise.all(
        imgs.map((img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener('load', () => resolve(), { once: true });
                img.addEventListener('error', () => resolve(), { once: true });
                setTimeout(() => resolve(), 8000);
              }),
        ),
      );
    });

    const outPath = path.join(OUT_DIR, `${spec.name}.png`);
    if (spec.widget) {
      await page.locator(`.widget-cell[data-widget="${spec.widget}"]`).screenshot({ path: outPath });
    } else {
      await page.screenshot({ path: outPath, fullPage: false });
    }
  } finally {
    await context.close();
  }
}

/**
 * Wait for the screenshots stack to be reachable again. Next.js dev mode can
 * crash under load; Docker restarts the container, which means we have to
 * wait for migrate + seed + dev-server-boot before retrying.
 */
async function waitForStackReady(timeoutMs = 180_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const resp = await fetch(`${BASE_URL}/api/health`);
      if (resp.ok) return true;
    } catch {
      // Server down — keep waiting.
    }
    await new Promise((r) => setTimeout(r, 5_000));
  }
  return false;
}

async function captureOne(spec: CaptureSpec): Promise<boolean> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await captureOnce(spec);
      console.log(`  ✓ ${spec.name}.png  (${spec.description})`);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes('ERR_EMPTY_RESPONSE') ||
        msg.includes('ECONNRESET') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('Timeout');

      if (isTransient && attempt < 3) {
        console.warn(`  ⟲ ${spec.name}  attempt ${attempt} failed (${msg.split('\n')[0]}); waiting for stack...`);
        await waitForStackReady();
        await new Promise((r) => setTimeout(r, 5_000));
        continue;
      }

      console.error(`  ✗ ${spec.name}  FAILED: ${msg.split('\n')[0]}`);
      return false;
    }
  }
  return false;
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  // Optional filter: `npm run screenshots:capture -- calendar` runs only specs
  // whose name contains "calendar". Multiple substrings combine with OR.
  const filterArgs = process.argv.slice(2);
  const specs = filterArgs.length
    ? SCREENSHOTS.filter((s) => filterArgs.some((f) => s.name.includes(f)))
    : SCREENSHOTS;

  if (specs.length === 0) {
    console.error(`No screenshots match filter: ${filterArgs.join(', ')}`);
    process.exit(1);
  }

  console.log(`\nCapturing ${specs.length} screenshots from ${BASE_URL}`);
  if (filterArgs.length) console.log(`Filter: ${filterArgs.join(', ')}`);
  console.log(`Output: ${OUT_DIR}\n`);

  // Quick health check before spinning up the browser
  try {
    const resp = await fetch(`${BASE_URL}/api/health`);
    if (!resp.ok) {
      throw new Error(`/api/health returned ${resp.status}`);
    }
  } catch (err) {
    console.error(`\nERROR: Cannot reach ${BASE_URL}.`);
    console.error('Boot the screenshots stack first:');
    console.error('  docker-compose -f docker-compose.screenshots.yml up -d\n');
    process.exit(1);
  }

  if (!FIXED_NOW) {
    console.warn('  PRISM_SEED_NOW is not set: shots use the real clock and will differ run to run.');
  }

  let ok = 0;
  let failed = 0;
  let restore: (() => Promise<void>) | null = null;
  const run = async (spec: CaptureSpec) => {
    if (await captureOne(spec)) ok++;
    else failed++;
    // Small pause between captures so the dev server has time to recover
    // from the previous on-demand compile before we hit it with another.
    await new Promise((r) => setTimeout(r, 1_500));
  };
  // Staged shots, grouped by look and dashboard so each is staged once.
  const stages = new Map<string, CaptureSpec[]>();
  for (const spec of specs) {
    if (!spec.stage) continue;
    const key = `${spec.stage.layout}:${spec.stage.look}`;
    stages.set(key, [...(stages.get(key) ?? []), spec]);
  }
  const otherSpecs = specs.filter((s) => !s.stage);

  try {
    // Staged shots show a new install, so they run before any demo photos
    // exist: with photos, the scenery steps aside.
    for (const group of stages.values()) {
      restore = await stageLook(await browserFor({} as CaptureSpec), group[0]!.stage!);
      for (const spec of group) await run(spec);
      await restore();
      restore = null;
    }

    // Demo photos for the Photos page and the screensaver. Cheap and shared,
    // so always run it.
    if (otherSpecs.length > 0) await ensureDemoPhotos(await browserFor({} as CaptureSpec));
    for (const spec of otherSpecs) await run(spec);
  } finally {
    if (restore) await restore().catch(() => {});
    for (const b of browsers.values()) await (await b).close();
  }

  if (specs.some((s) => s.name.startsWith('hero-'))) {
    console.log('\nFraming hero shots...');
    for (const f of await frameAll(OUT_DIR)) console.log(`  ✓ ${path.basename(f)}`);
  }

  console.log(`\nDone. ${ok} of ${specs.length} captured`);
  if (failed > 0) {
    console.log(`${failed} failed — re-run to retry, or capture individually.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
