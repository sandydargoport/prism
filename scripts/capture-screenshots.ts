/**
 * Auto-capture screenshots of every Prism feature for the docs site.
 *
 * Run against the screenshots stack (port :3010) with:
 *
 *   docker-compose -f docker-compose.screenshots.yml up -d
 *   # ... wait ~90s for first boot ...
 *   npm run screenshots:capture
 *
 * Saves to docs/demos/ with stable filenames so the docs site + README
 * references stay valid across re-runs. Captures both light + dark theme
 * for the main dashboard, plus mobile viewport variants.
 *
 * Login is automatic — uses Alex (parent) with PIN 1234 from the seed.
 * No setup wizard needed; the seed pre-creates users + settings + layout.
 */

import { chromium, Browser, BrowserContext, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.PRISM_URL || 'http://localhost:3010';
const PIN = '1234';
const OUT_DIR = path.resolve(__dirname, '..', 'docs', 'demos');

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 }; // iPhone 14

type CalendarViewType =
  | 'agenda'
  | 'day'
  | 'week'
  | 'weekVertical'
  | 'multiWeek'
  | 'month'
  | 'threeMonth';

interface CaptureSpec {
  name: string;
  url: string;
  description: string;
  /** Wait extra ms after navigation (for animations / lazy-load) */
  settleMs?: number;
  /** Set the theme before capture: 'light' | 'dark' (default light) */
  theme?: 'light' | 'dark';
  /** Mobile viewport instead of desktop */
  mobile?: boolean;
  /**
   * Pre-seed the calendar view via localStorage before navigation. The view
   * picker (ViewMenu) reads `prism-calendar-view-type` and `prism-calendar-
   * week-count` on mount, so this is the most reliable way to land on a
   * specific view — no need to click through the popover.
   */
  calendarView?: CalendarViewType;
  calendarWeekCount?: 1 | 2 | 3 | 4;
  /**
   * Pre-seed the calendar display mode (inline strips vs stacked cards).
   * Reads `prism-calendar-display-mode` localStorage on mount.
   */
  calendarDisplayMode?: 'inline' | 'cards';
  /** Optional pre-screenshot setup (e.g. click into a sub-view) */
  setup?: (page: Page) => Promise<void>;
}

const SCREENSHOTS: CaptureSpec[] = [
  // ─── Dashboard ─────────────────────────────────────────────
  {
    name: 'dashboard-light',
    url: '/',
    description: 'Dashboard with widgets (light mode)',
    theme: 'light',
    settleMs: 15000, // dashboard has many lazy-loaded widgets that each fetch async
  },
  {
    name: 'dashboard-dark',
    url: '/',
    description: 'Dashboard with widgets (dark mode)',
    theme: 'dark',
    settleMs: 15000,
  },
  {
    name: 'dashboard-mobile',
    url: '/',
    description: 'Mobile dashboard (single-column cards)',
    mobile: true,
    settleMs: 15000, // mobile cards each fetch async — match desktop dashboard
  },

  // ─── Calendar ──────────────────────────────────────────────
  // Each view is pre-seeded via localStorage rather than clicking the view
  // picker — see CaptureSpec.calendarView above for the rationale.
  {
    name: 'calendar-month',
    url: '/calendar',
    description: 'Calendar month view',
    settleMs: 6000,
    calendarView: 'month',
  },
  {
    name: 'calendar-multiweek',
    url: '/calendar',
    description: 'Calendar multi-week view (2 weeks)',
    settleMs: 6000,
    calendarView: 'multiWeek',
    calendarWeekCount: 2,
  },
  {
    name: 'calendar-week',
    url: '/calendar',
    description: 'Calendar schedule view (single-week timeline)',
    settleMs: 6000,
    calendarView: 'week',
  },
  {
    name: 'calendar-day',
    url: '/calendar',
    description: 'Calendar day view (side-by-side per-person columns)',
    settleMs: 6000,
    calendarView: 'day',
  },
  {
    name: 'calendar-agenda',
    url: '/calendar',
    description: 'Calendar agenda view (chronological list)',
    settleMs: 6000,
    calendarView: 'agenda',
  },
  {
    name: 'calendar-mobile',
    url: '/calendar',
    description: 'Mobile calendar (agenda-only)',
    mobile: true,
    settleMs: 5000,
    calendarView: 'agenda',
  },
  // Cards-mode variants — show stacked event cards in each day cell, with
  // overlay rows below the calendar grid for meals/chores/tasks per day.
  {
    name: 'calendar-month-cards',
    url: '/calendar',
    description: 'Calendar month view in cards mode (with meal/chore/task overlays)',
    settleMs: 7000,
    calendarView: 'month',
    calendarDisplayMode: 'cards',
  },
  {
    name: 'calendar-multiweek-cards',
    url: '/calendar',
    description: 'Calendar multi-week view in cards mode (2 weeks)',
    settleMs: 7000,
    calendarView: 'multiWeek',
    calendarWeekCount: 2,
    calendarDisplayMode: 'cards',
  },
  {
    name: 'calendar-mobile-cards',
    url: '/calendar',
    description: 'Mobile calendar in cards mode',
    mobile: true,
    settleMs: 6000,
    calendarView: 'agenda',
    calendarDisplayMode: 'cards',
  },

  // ─── Shopping ──────────────────────────────────────────────
  {
    name: 'shopping',
    url: '/shopping',
    description: 'Shopping list with category grid',
    settleMs: 1000,
  },
  {
    name: 'shopping-mobile',
    url: '/shopping',
    description: 'Mobile shopping list',
    mobile: true,
    settleMs: 1000,
  },

  // ─── Recipes ───────────────────────────────────────────────
  {
    name: 'recipes',
    url: '/recipes',
    description: 'Recipe library grid',
    settleMs: 1000,
  },

  // ─── Tasks ─────────────────────────────────────────────────
  {
    name: 'tasks',
    url: '/tasks',
    description: 'Tasks page with multiple lists',
    settleMs: 1000,
  },

  // ─── Chores ────────────────────────────────────────────────
  {
    name: 'chores',
    url: '/chores',
    description: 'Chores grouped by person',
    settleMs: 1000,
  },

  // ─── Meals ─────────────────────────────────────────────────
  {
    name: 'meals',
    url: '/meals',
    description: 'Weekly meal planner',
    settleMs: 1000,
  },

  // ─── Goals ─────────────────────────────────────────────────
  {
    name: 'goals',
    url: '/goals',
    description: 'Goals page with points waterfall',
    settleMs: 1000,
  },

  // ─── Wishes & Gift Ideas ───────────────────────────────────
  {
    name: 'wishes',
    url: '/wishes',
    description: 'Wish lists with claim tracking',
    settleMs: 1000,
  },

  // ─── Photos ────────────────────────────────────────────────
  {
    name: 'photos',
    url: '/photos',
    description: 'Photo gallery',
    settleMs: 1500,
  },

  // ─── Travel Map ────────────────────────────────────────────
  {
    name: 'travel-globe',
    url: '/travel',
    description: 'Travel map globe with pins',
    settleMs: 3500, // globe takes time to render
  },

  // ─── Weekend Ideas ─────────────────────────────────────────
  {
    name: 'weekend',
    url: '/weekend',
    description: 'Weekend Ideas activity board',
    settleMs: 3000,
  },

  // ─── Messages ──────────────────────────────────────────────
  {
    name: 'messages',
    url: '/messages',
    description: 'Family message board',
    settleMs: 1000,
  },
];

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

async function captureOnce(browser: Browser, spec: CaptureSpec): Promise<void> {
  const viewport = spec.mobile ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT;
  const context: BrowserContext = await browser.newContext({
    baseURL: BASE_URL,
    viewport,
    reducedMotion: 'reduce',
    colorScheme: spec.theme === 'dark' ? 'dark' : 'light',
  });

  const page = await context.newPage();

  // Pre-seed localStorage BEFORE first paint so the page renders directly in
  // the requested state (theme + calendar view) without a mid-load swap.
  // Without this, switching state after mount re-triggers widget loading
  // states and the settle wait can capture a half-loaded view.
  await page.addInitScript(
    ({ theme, calendarView, calendarWeekCount, calendarDisplayMode }) => {
      try {
        if (theme) {
          localStorage.setItem('theme', theme);
          document.documentElement.classList.remove('light', 'dark');
          document.documentElement.classList.add(theme);
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
      theme: spec.theme ?? null,
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

    const outPath = path.join(OUT_DIR, `${spec.name}.png`);
    await page.screenshot({ path: outPath, fullPage: false });
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

async function captureOne(browser: Browser, spec: CaptureSpec): Promise<boolean> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await captureOnce(browser, spec);
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

  const browser = await chromium.launch();
  let ok = 0;
  let failed = 0;

  try {
    for (const spec of specs) {
      const success = await captureOne(browser, spec);
      if (success) ok++;
      else failed++;
      // Small pause between captures so the dev server has time to recover
      // from the previous on-demand compile before we hit it with another.
      await new Promise((r) => setTimeout(r, 1_500));
    }
  } finally {
    await browser.close();
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
