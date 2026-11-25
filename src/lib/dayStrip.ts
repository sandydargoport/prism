import type { BusTime, ScreenSwitch } from './screenSwitches';
import { DAY_MINUTES, sceneAt, switchSpans, type Span, type SwitchSpan } from './dayWaypoints';

/**
 * The Screen tab's strip (#1349): today as one bar, night as shading, each
 * switch a band in its row's colour, and a line at now. These place them in
 * pixels for a bar `width` wide, from the spans `nightSpans` and
 * `switchSpans` give, the same the canvas and the wall go by.
 *
 * A band is never narrower than `MIN_BAND_PX`, so a 15-minute switch is
 * still something to see and to match to its row; one widened at an end of
 * the bar grows inwards so it stays inside it. The exact times are in the
 * rows, never only here.
 */

/** The narrowest a switch's band is drawn. */
export const MIN_BAND_PX = 12;

export type StripBox = { left: number; width: number };
export type StripBand = StripBox & { index: number; from: number; to: number };
export type StripGeometry = { nights: StripBox[]; bands: StripBand[]; now: number };

const x = (minute: number, width: number) => (Math.min(DAY_MINUTES, Math.max(0, minute)) / DAY_MINUTES) * width;

/** Where a stretch of the day sits on a bar `width` pixels wide, at least `min` wide and inside the bar. */
function box(span: Span, width: number, min = 0): StripBox {
  const left = x(span.from, width);
  const w = Math.min(width, Math.max(min, x(span.to, width) - left));
  return { left: Math.max(0, Math.min(left, width - w)), width: w };
}

export function stripGeometry({ width, nights, spans, now, minBand = MIN_BAND_PX }: {
  width: number;
  nights: readonly Span[];
  spans: readonly SwitchSpan[];
  /** Now, in minutes into the day. */
  now: number;
  minBand?: number;
}): StripGeometry {
  return {
    nights: nights.map((n) => box(n, width)),
    // The lower rows first, so where two overlap the higher one, which wins, is drawn on top.
    bands: [...spans].sort((a, b) => b.index - a.index || a.from - b.from).map((s) => ({ index: s.index, from: s.from, to: s.to, ...box(s, width, minBand) })),
    now: x(now, width),
  };
}

/**
 * Whether each switch ever shows, through a week: `never` when every minute
 * it is in force a higher row is too, `partly` when a higher row takes some
 * of it, `always` otherwise, and `idle` for one that is never in force (no
 * route set up, say). `by` lists the higher rows that take its time. Worked
 * out with `sceneAt`, which says which switch the screen shows at a minute.
 */
export type SwitchCover = { shows: 'always' | 'partly' | 'never' | 'idle'; by: number[] };

export function switchCoverage(
  switches: readonly ScreenSwitch[],
  routes: readonly BusTime[] = [],
  exists: (dashboardId: string) => boolean = () => true,
): SwitchCover[] {
  const inForce = switches.map(() => 0);
  const shown = switches.map(() => 0);
  const by = switches.map(() => new Set<number>());
  for (let weekday = 0; weekday < 7; weekday++) {
    const spans = switchSpans(switches, weekday, routes);
    if (spans.length === 0) continue;
    for (let minute = 0; minute < DAY_MINUTES; minute++) {
      const here = spans.filter((s) => s.from <= minute && minute < s.to);
      if (here.length === 0) continue;
      const { switchIndex } = sceneAt(minute, { spans: here, switches, nights: [], shownId: '', exists });
      for (const index of new Set(here.map((s) => s.index))) {
        inForce[index]! += 1;
        if (index === switchIndex) shown[index]! += 1;
        else if (switchIndex >= 0 && switchIndex < index) by[index]!.add(switchIndex);
      }
    }
  }
  return switches.map((_, i) => ({
    shows: inForce[i] === 0 ? 'idle' : shown[i] === 0 ? 'never' : shown[i]! < inForce[i]! ? 'partly' : 'always',
    by: [...by[i]!].sort((a, b) => a - b),
  }));
}
