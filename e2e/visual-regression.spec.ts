/**
 * Visual regression suite.
 *
 * Catches render-shape bugs that pure code review cannot see: dark-mode
 * contrast, stacking-context regressions, accidental layout drift,
 * theme-resolution timing issues. See docs/code-review-modalities.md for
 * the broader rationale.
 *
 * USAGE:
 *   First time (or after intentional UI change):
 *     npm run test:visual:update
 *     # → captures new baseline screenshots under
 *     #   e2e/visual-regression.spec.ts-snapshots/
 *
 *   Subsequent runs:
 *     npm run test:visual
 *     # → compares against baselines, fails on diff above tolerance
 *
 * STABILITY NOTES:
 * - Animations are disabled via `reducedMotion: 'reduce'` to remove timing flakiness.
 * - The dynamic widgets (Clock, Weather, Photo) are masked because they show
 *   live time / live weather / a rotating photo and would never compare equal.
 * - `maxDiffPixelRatio` is set to 1% to absorb sub-pixel font rendering
 *   differences across hosts. Tighten over time as flakes are eliminated.
 * - Tests reset all data + flush Redis + login fresh in beforeAll so the
 *   visible state depends only on the seed, not on prior test runs.
 *
 * TEST-ENVIRONMENT DEPENDENCY (HARD REQUIREMENT — PII):
 * - Visual baselines capture EVERYTHING on screen: member names in the
 *   PIN modal, calendar event titles, the wallpaper photo, weather city,
 *   bus stop names. ALL of that is PII when run against a live deployment.
 * - Per `CLAUDE.md` PII policy, real names / photos / addresses MUST NOT
 *   be committed. So baselines may ONLY be captured against a synthetic-
 *   seed DB with anonymized fixtures.
 * - Set `E2E_HAS_TEST_DB=1` (and optionally `E2E_PIN=...`) when running
 *   against such a DB. Without that flag, every test in this spec is
 *   skipped — by design — to prevent accidental PII capture.
 * - Required synthetic seed (for future implementation): family members
 *   named "Alice/Bob/Carol/Dan", a fixture wallpaper from `tests/fixtures/`,
 *   no real calendar events, no real bus routes, no real weather location.
 */

import { test, expect, Page } from '@playwright/test';
import { execSync } from 'child_process';
import { loginViaAPI } from './helpers/auth';
import { resetAll } from './helpers/reset';

/**
 * Pull a seeded parent's name directly from the DB.
 *
 * The shared `getFirstParent(page)` helper relies on `/api/family` returning
 * the `role` field, which it only does for authenticated requests — chicken
 * and egg for any spec that needs to log in from a fresh page. Querying the
 * DB sidesteps the issue and keeps the parent's name out of the test source.
 */
function getSeededParentName(): string {
  const dbName = process.env.E2E_DB_NAME || 'prism';
  const out = execSync(
    `docker exec prism-db psql -U prism -d ${dbName} -At -c "SELECT name FROM users WHERE role = 'parent' ORDER BY created_at LIMIT 1"`,
    { encoding: 'utf-8' },
  ).trim();
  if (!out) throw new Error('No seeded parent in DB — did seeds run?');
  return out;
}

// Widgets whose rendered content changes between runs. Masked from the
// screenshot (rendered as solid colored rectangles in the diff).
function dynamicMasks(page: Page) {
  return [
    page.locator('[data-widget="Clock"]'),
    page.locator('[data-widget="Weather"]'),
    page.locator('[data-widget="Photo"]'),
  ];
}

const SCREENSHOT_OPTIONS = {
  maxDiffPixelRatio: 0.01,
  animations: 'disabled' as const,
  fullPage: false,
};

/** Set theme + perf mode via localStorage before any page script runs. */
async function setClientFlags(
  page: Page,
  opts: { theme?: 'light' | 'dark'; perfMode?: boolean } = {}
) {
  const { theme = 'light', perfMode = false } = opts;
  await page.addInitScript(
    ([t, p]) => {
      localStorage.setItem('prism-theme', t as string);
      localStorage.setItem('prism-perf-mode', String(p));
      // Disable auto-hide so the toolbar stays visible during screenshots.
      localStorage.setItem('prism:auto-hide-ui', 'false');
    },
    [theme, perfMode],
  );
}

/**
 * Auth-required tests only run when a fresh test DB is available.
 * Live deployments have unknown PINs; running these would 400 on login.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';

test.describe('Visual regression', () => {
  let parentName: string;

  test.beforeAll(() => {
    if (HAS_TEST_DB) {
      resetAll();
      parentName = getSeededParentName();
    }
  });

  test.use({
    contextOptions: { reducedMotion: 'reduce' },
    viewport: { width: 1920, height: 1080 },
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`dashboard - ${theme}`, async ({ page }) => {
      test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
      await setClientFlags(page, { theme });
      await loginViaAPI(page, parentName);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(800); // let theme + seasonal vars settle

      await expect(page).toHaveScreenshot(`dashboard-${theme}.png`, {
        ...SCREENSHOT_OPTIONS,
        mask: dynamicMasks(page),
      });
    });

    test(`dashboard perf-mode - ${theme}`, async ({ page }) => {
      test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
      await setClientFlags(page, { theme, perfMode: true });
      await loginViaAPI(page, parentName);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(800);

      await expect(page).toHaveScreenshot(`dashboard-perf-${theme}.png`, {
        ...SCREENSHOT_OPTIONS,
        mask: dynamicMasks(page),
      });
    });

    test(`calendar - ${theme}`, async ({ page }) => {
      test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
      await setClientFlags(page, { theme });
      await loginViaAPI(page, parentName);
      await page.goto('/calendar');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(800);

      await expect(page).toHaveScreenshot(`calendar-${theme}.png`, SCREENSHOT_OPTIONS);
    });

    test(`settings - ${theme}`, async ({ page }) => {
      test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
      await setClientFlags(page, { theme });
      await loginViaAPI(page, parentName);
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(800);

      await expect(page).toHaveScreenshot(`settings-${theme}.png`, SCREENSHOT_OPTIONS);
    });
  }

  // ─── Calendar view modes ────────────────────────────────────────────────
  // The v1.7.0 calendar refactor introduced ten view modes (Agenda, Day, List,
  // Schedule, 1W, 2W, 3W, 4W, Month, 3M) and a cards display mode that can
  // toggle on top of most of them. Each combination has its own layout
  // primitives — capture the ones most likely to regress when the calendar
  // surface is refactored next.
  //
  // Note: view modes are persisted to localStorage (`prism-calendar-view-type`,
  // `prism-calendar-week-count`, `prism-calendar-display-mode`) so we set them
  // via addInitScript before the page loads. That avoids racing the toolbar.

  async function setCalendarPrefs(
    page: Page,
    opts: { viewType: string; displayMode?: 'inline' | 'cards'; weekCount?: number },
  ) {
    const { viewType, displayMode = 'inline', weekCount = 2 } = opts;
    await page.addInitScript(
      ([v, d, w]) => {
        localStorage.setItem('prism-calendar-view-type', v as string);
        localStorage.setItem('prism-calendar-display-mode', d as string);
        localStorage.setItem('prism-calendar-week-count', String(w));
      },
      [viewType, displayMode, weekCount],
    );
  }

  // We sweep light + dark for the highest-risk combinations only — full matrix
  // (every view × every theme × every display mode) would be 60+ baselines and
  // most would be redundant.
  const calendarMatrix = [
    { view: 'month',     displayMode: 'inline' as const, label: 'month-inline' },
    { view: 'month',     displayMode: 'cards'  as const, label: 'month-cards' },
    { view: 'multiWeek', displayMode: 'cards'  as const, label: 'multiweek-2w-cards', weekCount: 2 },
    { view: 'week',      displayMode: 'cards'  as const, label: 'week-cards' },
    { view: 'agenda',    displayMode: 'cards'  as const, label: 'agenda-cards' },
  ];

  for (const theme of ['light', 'dark'] as const) {
    for (const cfg of calendarMatrix) {
      test(`calendar ${cfg.label} - ${theme}`, async ({ page }) => {
        test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
        await setClientFlags(page, { theme });
        await setCalendarPrefs(page, {
          viewType: cfg.view,
          displayMode: cfg.displayMode,
          weekCount: cfg.weekCount,
        });
        await loginViaAPI(page, parentName);
        await page.goto('/calendar');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(800);

        await expect(page).toHaveScreenshot(`calendar-${cfg.label}-${theme}.png`, {
          ...SCREENSHOT_OPTIONS,
          mask: dynamicMasks(page),
        });
      });
    }
  }

  // ─── AddEventModal ──────────────────────────────────────────────────────
  // The Add Event button on /calendar opens the AddEventModal. Capture both
  // themes — modals overlay backdrop-blur which is a frequent stacking-context
  // regression source.
  for (const theme of ['light', 'dark'] as const) {
    test(`AddEventModal - ${theme}`, async ({ page }) => {
      test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
      await setClientFlags(page, { theme });
      await loginViaAPI(page, parentName);
      await page.goto('/calendar');
      await page.waitForLoadState('networkidle');
      await page.click('button:has-text("Add Event")');
      // Modal is portal-rendered; wait for its title rather than a specific selector.
      await page.waitForSelector('text=/Add Event|New Event/i', { timeout: 5000 });
      await page.waitForTimeout(400);

      await expect(page).toHaveScreenshot(`add-event-modal-${theme}.png`, SCREENSHOT_OPTIONS);
    });
  }

  // ─── Settings sub-sections ──────────────────────────────────────────────
  // Settings is split into sections; each has its own layout. Capture the
  // ones most exposed to theme/contrast regressions.
  const settingsSections = ['family', 'display', 'integrations'] as const;

  for (const theme of ['light', 'dark'] as const) {
    for (const section of settingsSections) {
      test(`settings/${section} - ${theme}`, async ({ page }) => {
        test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
        await setClientFlags(page, { theme });
        await loginViaAPI(page, parentName);
        await page.goto(`/settings#${section}`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(800);

        await expect(page).toHaveScreenshot(`settings-${section}-${theme}.png`, SCREENSHOT_OPTIONS);
      });
    }
  }

  // PIN modal tests — also gated on E2E_HAS_TEST_DB because the modal
  // shows the seeded family members' names, which would be PII against
  // a live deployment.
  for (const theme of ['light', 'dark'] as const) {
    test(`login landing page - ${theme}`, async ({ page }) => {
      test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a synthetic-seed DB');
      await setClientFlags(page, { theme });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(600);

      await expect(page).toHaveScreenshot(`login-landing-${theme}.png`, {
        ...SCREENSHOT_OPTIONS,
        mask: dynamicMasks(page),
      });
    });

    test(`PIN modal - ${theme}`, async ({ page }) => {
      test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a synthetic-seed DB');
      await setClientFlags(page, { theme });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.click('button[aria-label="Log in"]');
      await page.waitForSelector('.z-\\[10001\\]', { timeout: 5000 });
      await page.waitForTimeout(400);

      await expect(page).toHaveScreenshot(`pin-modal-${theme}.png`, SCREENSHOT_OPTIONS);
    });
  }
});
