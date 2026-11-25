/**
 * A screen's row in Settings > Screens (#1351) says the screen's sentence,
 * the same one its editor's Screen tab shows at the top (see ScreenSheet):
 *
 *   Hallway shows Main. Idle for 2 minutes, it becomes a photo frame. At
 *   night the photo frame is 50% darker.
 *
 * The inputs are read from the screen's row as the editor reads them from
 * the screen: its dashboard (none is the one new and unnamed screens show),
 * its switches, and from its settings how long until it idles and its day.
 * A screen with no day of its own goes by the household's starting day, as
 * the wall does. Plain function, so a test can check it without a browser.
 */
import { MOBILE_BREAKPOINT } from '@/lib/hooks/useIsMobile';
import { backgroundOf, effectiveScreenDay, LEGACY_DIM_KEY, SCREEN_DAY_KEY, type ScreenDay } from '@/lib/screenDay';
import { screenSentence } from '@/lib/screenSentence';
import type { BusTime, ScreenSwitch } from '@/lib/screenSwitches';
import type { ScreenSettings } from './screenSettings';

/** How long a screen waits before it idles when it never chose, in seconds (useScreensaverTimeout). */
const DEFAULT_IDLE_AFTER = 120;

export type ScreenRow = {
  name: string;
  /** The dashboard it normally shows; null is the one new and unnamed screens show. */
  dashboardId: string | null;
  switches: readonly ScreenSwitch[];
  settings: ScreenSettings | null | undefined;
  /** Its reported width; null when it has not reported one. */
  width?: number | null;
};

export type ScreenRowContext = {
  dashboards: ReadonlyArray<{ id: string; name: string; isDefault?: boolean }>;
  /** The household's starting day, for a screen with no day of its own. */
  household: ScreenDay;
  /** The bus routes, for which days bus time is; null while not known. */
  routes?: readonly BusTime[] | null;
  clock: (hhmm: string) => string;
};

/** How long until it idles, as its Idle after reads it: 2 minutes unless it chose. */
export function idleAfterOf(settings: ScreenSettings | null | undefined): number {
  const raw = settings?.['prism-screensaver-timeout'];
  const n = raw === undefined || raw === null || raw === '' ? NaN : Number(raw);
  return Number.isFinite(n) ? n : DEFAULT_IDLE_AFTER;
}

export function screenRowSentence(row: ScreenRow, ctx: ScreenRowContext): string {
  const named = (id: string) => ctx.dashboards.find((d) => d.id === id)?.name ?? null;
  const fallback = ctx.dashboards.find((d) => d.isDefault)?.name ?? 'the default dashboard';
  const own = (row.settings ?? {}) as Record<string, string | undefined>;
  const day = effectiveScreenDay(own[SCREEN_DAY_KEY] ?? null, ctx.household, own[LEGACY_DIM_KEY] ?? null);
  return screenSentence({
    name: row.name,
    normally: (row.dashboardId && named(row.dashboardId)) || fallback,
    switches: row.switches,
    dashboardName: named,
    routes: ctx.routes,
    background: backgroundOf(day),
    nightLevel: day.nightLevel,
    idleAfter: idleAfterOf(row.settings),
    // Too narrow to idle, as the editor says of a screen drawn below a wall's width.
    canIdle: row.width == null || row.width >= MOBILE_BREAKPOINT,
    clock: ctx.clock,
  });
}
